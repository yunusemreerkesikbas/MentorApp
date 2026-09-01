import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import * as express from "express";
import { Pool, type PoolClient } from "pg";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";
import { signFakeWebhook } from "../src/modules/payments/infrastructure/adapters/fake-payments.adapter";

const SECRET = "test-payments-webhook-secret"; // matches vitest env
// Event ids must be unique PER RUN: the idempotency belt persists in mentor_test across runs,
// so a reused id would be treated as a replay and silently not applied.
const RUN = Date.now();
const evt = (name: string) => `evt_promo_${name}_${RUN}`;
const CRON_SECRET = `promo-cron-secret-for-e2e-${RUN}-only`;

const LIST_PRICE = 24_900; // premium-monthly, seeded by migration 0003
const CHARGED = 19_920; // 20% off, Math.round(24900 * 0.2) = 4980

const CONFIG_OVERRIDES: Record<string, unknown> = {
  "promotions.enabled": true,
  "promotions.max_percent": 50,
  "promotions.max_discount_periods": 1,
};

interface StoredConfigOverride {
  key: string;
  value: unknown;
  updated_by: string | null;
  updated_at: Date;
}

/**
 * Promotions e2e — the money path against a real Postgres (RLS active), driven through the
 * FakePaymentsAdapter and signed fake webhooks.
 *
 * The point of this suite is the things unit tests cannot prove: that the discounted amount really
 * reaches the LEDGER and the invoice, that an abandoned checkout gives its seat back, and that the
 * global cap holds under genuine concurrency.
 */
describe("promotions (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let previousConfigRows: StoredConfigOverride[] = [];
  const promotionIds: string[] = [];
  /** Read-only: never checks out, so it stays reusable across tests. */
  let reader: { token: string; userId: string };
  /** Checks out; reset between tests. */
  let buyer: { token: string; userId: string };
  /** Second racer for the concurrency test. */
  let rival: { token: string; userId: string };

  const svc = async <T>(fn: (c: PoolClient) => Promise<T>): Promise<T> => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('app.role','SERVICE',true)");
      const result = await fn(c);
      await c.query("commit");
      return result;
    } catch (err) {
      await c.query("rollback");
      throw err;
    } finally {
      c.release();
    }
  };

  const serviceQuery = (text: string, values?: unknown[]) =>
    svc((c) => c.query(text, values));

  /**
   * `/v1/auth/signup` is throttled at 5/min, so this suite signs up exactly THREE users in
   * `beforeAll` and recycles them with {@link resetUser} instead of minting one per test.
   */
  async function signup(tag: string): Promise<{ token: string; userId: string }> {
    const res = await request(app.getHttpServer()).post("/v1/auth/signup").send({
      email: `promo-${tag}-${RUN}@test.local`,
      password: "Sifre1234",
      displayName: `Promo ${tag}`,
      kvkkAccepted: true,
    });
    expect(res.status).toBe(201);
    return { token: res.body.accessToken, userId: res.body.user.id };
  }

  /** Return a recycled user to "never subscribed": no open row, no ledger, no redemption. */
  async function resetUser(userId: string): Promise<void> {
    await serviceQuery("delete from promotion_redemptions where user_id = $1", [userId]);
    await serviceQuery("delete from payment_transactions where user_id = $1", [userId]);
    await serviceQuery("delete from subscriptions where user_id = $1", [userId]);
  }

  /** Seed a promotion directly; the admin API is covered by its own controller tests. */
  async function seedPromotion(fields: {
    code?: string | null;
    ruleType?: string;
    ruleParams?: object;
    discountType?: string;
    discountValue?: number;
    maxRedemptions?: number | null;
    maxRedemptionsPerUser?: number;
  }): Promise<string> {
    const result = await serviceQuery(
      `insert into promotions
         (code,name,label_tr,label_en,rule_type,rule_params,discount_type,discount_value,
          max_redemptions,max_redemptions_per_user)
       values ($1,$2,'Test hediyesi','Test gift',$3,$4::jsonb,$5,$6,$7,$8)
       returning id`,
      [
        fields.code ?? null,
        `e2e ${RUN} ${fields.code ?? "auto"} ${promotionIds.length}`,
        fields.ruleType ?? "ANYONE",
        JSON.stringify(fields.ruleParams ?? {}),
        fields.discountType ?? "PERCENT",
        fields.discountValue ?? 20,
        fields.maxRedemptions ?? null,
        fields.maxRedemptionsPerUser ?? 1,
      ],
    );
    const id = (result.rows[0] as { id: string }).id;
    promotionIds.push(id);
    return id;
  }

  /** Retire every promotion this suite created, so tests do not leak into each other. */
  async function retireAll(): Promise<void> {
    if (promotionIds.length === 0) return;
    await serviceQuery("update promotions set is_active = false where id = any($1::uuid[])", [
      promotionIds,
    ]);
  }

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    process.env.CRON_SECRET = CRON_SECRET;

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    // Mirror main.ts: capture the raw body for webhook signature verification.
    app.use(
      express.json({
        verify: (req: { rawBody?: Buffer }, _res, buf: Buffer) => {
          req.rawBody = buf;
        },
      }),
    );
    await app.init();

    const previous = await serviceQuery(
      "select key,value,updated_by,updated_at from config_overrides where key = any($1::text[])",
      [Object.keys(CONFIG_OVERRIDES)],
    );
    previousConfigRows = previous.rows as StoredConfigOverride[];

    reader = await signup("reader");
    buyer = await signup("buyer");
    rival = await signup("rival");

    const registry = app.get(ConfigRegistryService);
    for (const [key, value] of Object.entries(CONFIG_OVERRIDES)) {
      await registry.set(reader.userId, key, value);
    }
  }, 90_000);

  // Every test seeds its own promotion; retiring here means one cannot leak into the next.
  afterEach(async () => {
    await retireAll();
    await resetUser(buyer.userId);
    await resetUser(rival.userId);
  });

  afterAll(async () => {
    if (pool) {
      await retireAll();
      await serviceQuery("delete from config_overrides where key = any($1::text[])", [
        Object.keys(CONFIG_OVERRIDES),
      ]);
      for (const row of previousConfigRows) {
        await serviceQuery(
          `insert into config_overrides (key,value,updated_by,updated_at)
           values ($1,$2::jsonb,$3,$4)`,
          [row.key, JSON.stringify(row.value), row.updated_by, row.updated_at],
        );
      }
    }
    await app?.close();
    await pool?.end();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  it("offers the list price when no promotion is live", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/subscription/offers")
      .set(auth(reader.token))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.offers["premium-monthly"]).toMatchObject({
      listPriceMinor: LIST_PRICE,
      discountMinor: 0,
      chargedPriceMinor: LIST_PRICE,
      promotion: null,
    });
  });

  it("rejects an unknown coupon instead of silently charging the list price", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/subscription/offers")
      .set(auth(reader.token))
      .send({ code: "YOKBOYLEKOD" });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("PROMOTION_NOT_FOUND");
    // The message is localized by the API — the client displays it verbatim.
    expect(typeof res.body.message).toBe("string");
  });

  it("surfaces a coded promotion the user qualifies for without applying it", async () => {
    await seedPromotion({ code: `WAIT${RUN}` });
    const res = await request(app.getHttpServer())
      .post("/v1/subscription/offers")
      .set(auth(reader.token))
      .send({});

    expect(res.body.available).toHaveLength(1);
    expect(res.body.available[0].code).toBe(`WAIT${RUN}`);
    // Listed, but NOT applied — the user still has to type it.
    expect(res.body.offers["premium-monthly"].discountMinor).toBe(0);
  });

  it("carries the discount from checkout through the ledger", async () => {
    const code = `LEDGER${RUN}`;
    await seedPromotion({ code });
    const { token, userId } = buyer;

    const preview = await request(app.getHttpServer())
      .post("/v1/subscription/offers")
      .set(auth(token))
      .send({ code });
    expect(preview.body.offers["premium-monthly"].chargedPriceMinor).toBe(CHARGED);

    const checkout = await request(app.getHttpServer())
      .post("/v1/subscription/checkout")
      .set(auth(token))
      .send({ planId: "premium-monthly", code });
    expect(checkout.status).toBe(200);

    // The agreed price is frozen on the redemption row, in the same commit as the subscription.
    const redemption = await serviceQuery(
      `select r.list_price_minor, r.discount_minor, r.charged_price_minor,
              r.periods_remaining, r.status, r.subscription_id
         from promotion_redemptions r where r.user_id = $1`,
      [userId],
    );
    expect(redemption.rows).toHaveLength(1);
    expect(redemption.rows[0]).toMatchObject({
      list_price_minor: LIST_PRICE,
      discount_minor: LIST_PRICE - CHARGED,
      charged_price_minor: CHARGED,
      periods_remaining: 1,
      status: "RESERVED",
    });

    // /v1/subscription reports what the user actually pays, not the catalog price.
    const view = await request(app.getHttpServer()).get("/v1/subscription").set(auth(token));
    expect(view.body.discount).toMatchObject({
      listPriceMinor: LIST_PRICE,
      chargedPriceMinor: CHARGED,
      periodsRemaining: 1,
    });

    // A renewal that reports no amount must still be ledgered at the DISCOUNTED price —
    // the old `?? plan.priceMinor` fallback would have overstated it by 49,80 ₺.
    const providerRef = (
      await serviceQuery("select provider_ref from subscriptions where user_id = $1", [userId])
    ).rows[0].provider_ref as string;
    const { body, headers } = signFakeWebhook(SECRET, {
      eventId: evt("renewal"),
      type: "payment_succeeded",
      providerRef,
    });
    const hook = await request(app.getHttpServer())
      .post("/v1/webhooks/payments")
      .set(headers)
      .send(JSON.parse(body));
    expect(hook.status).toBe(200);

    const ledger = await serviceQuery(
      `select amount_minor from payment_transactions
        where user_id = $1 and type = 'RENEWAL' and status = 'SUCCEEDED'`,
      [userId],
    );
    expect(ledger.rows).toHaveLength(1);
    expect(ledger.rows[0].amount_minor).toBe(CHARGED);

    // One covered charge consumed → the next renewal falls back to the list price.
    const after = await serviceQuery(
      "select periods_remaining, status from promotion_redemptions where user_id = $1",
      [userId],
    );
    expect(after.rows[0].periods_remaining).toBe(0);
  });

  it("gives the seat back when a checkout is abandoned", async () => {
    const code = `VOID${RUN}`;
    const promotionId = await seedPromotion({ code, maxRedemptions: 1 });
    const { token, userId } = buyer;

    await request(app.getHttpServer())
      .post("/v1/subscription/checkout")
      .set(auth(token))
      .send({ planId: "premium-monthly", code });

    // Force the verification-gate state the hosted-page provider would leave behind.
    await serviceQuery("update subscriptions set status = 'INCOMPLETE' where user_id = $1", [
      userId,
    ]);

    // A second checkout discards the abandoned row — and must release the promotion seat with it,
    // otherwise a one-seat campaign would be permanently burned by an unpaid attempt.
    const retry = await request(app.getHttpServer())
      .post("/v1/subscription/checkout")
      .set(auth(token))
      .send({ planId: "premium-monthly", code });
    expect(retry.status).toBe(200);

    const counted = await serviceQuery(
      `select count(*)::int as n from promotion_redemptions
        where promotion_id = $1 and status <> 'VOIDED'`,
      [promotionId],
    );
    expect(counted.rows[0].n).toBe(1); // the retry, not the abandoned attempt
  });

  it("holds the global cap when two users race for the last seat", async () => {
    const code = `RACE${RUN}`;
    const promotionId = await seedPromotion({ code, maxRedemptions: 1 });
    const a = buyer;
    const b = rival;

    // Both pass the advisory check; only one may pass the authoritative one inside the
    // transaction. Without the per-promotion advisory lock both would read `used = 0`.
    const results = await Promise.all([
      request(app.getHttpServer())
        .post("/v1/subscription/checkout")
        .set(auth(a.token))
        .send({ planId: "premium-monthly", code }),
      request(app.getHttpServer())
        .post("/v1/subscription/checkout")
        .set(auth(b.token))
        .send({ planId: "premium-monthly", code }),
    ]);

    const statuses = results.map((r) => r.status).sort();
    expect(statuses[0]).toBe(200);
    // The loser is refused, never quietly charged the list price.
    expect(statuses[1]).toBeGreaterThanOrEqual(400);

    const counted = await serviceQuery(
      `select count(*)::int as n from promotion_redemptions
        where promotion_id = $1 and status <> 'VOIDED'`,
      [promotionId],
    );
    expect(counted.rows[0].n).toBe(1);
  });

  it("refuses a coupon the user has already redeemed", async () => {
    const code = `ONCE${RUN}`;
    await seedPromotion({ code, maxRedemptionsPerUser: 1 });
    const { token } = buyer;

    const first = await request(app.getHttpServer())
      .post("/v1/subscription/checkout")
      .set(auth(token))
      .send({ planId: "premium-monthly", code });
    expect(first.status).toBe(200);

    const second = await request(app.getHttpServer())
      .post("/v1/subscription/offers")
      .set(auth(token))
      .send({ code });
    expect(second.status).toBe(422);
  });

  it("retires a lapsed subscription and only then honours WIN_BACK", async () => {
    // Regression lock. Nothing except the provider cancel webhook writes EXPIRED, so before the
    // sweeper existed a subscription that simply ran out stayed ACTIVE forever and the WIN_BACK
    // rule silently matched nobody.
    const code = `WINBACK${RUN}`;
    await seedPromotion({ code, ruleType: "WIN_BACK" });
    const { token, userId } = buyer;

    await request(app.getHttpServer())
      .post("/v1/subscription/checkout")
      .set(auth(token))
      .send({ planId: "premium-monthly" });

    // Wind the paid period into the past — exactly what a lapse looks like in the table.
    await serviceQuery(
      `update subscriptions
          set status = 'ACTIVE', trial_ends_at = null,
              current_period_end = now() - interval '10 days'
        where user_id = $1`,
      [userId],
    );

    const sweep = await request(app.getHttpServer())
      .post("/v1/internal/cron/expire-subscriptions")
      .set("x-cron-secret", CRON_SECRET);
    expect(sweep.status).toBe(201);

    const row = await serviceQuery("select status from subscriptions where user_id = $1", [userId]);
    expect(row.rows[0].status).toBe("EXPIRED");

    // The discount now actually applies — this assertion fails on the pre-sweeper code.
    const offers = await request(app.getHttpServer())
      .post("/v1/subscription/offers")
      .set(auth(token))
      .send({ code });
    expect(offers.status).toBe(200);
    expect(offers.body.offers["premium-monthly"].chargedPriceMinor).toBe(CHARGED);
    await retireAll();
  });

  it("rejects an unauthenticated expiry sweep", async () => {
    const res = await request(app.getHttpServer()).post("/v1/internal/cron/expire-subscriptions");
    expect(res.status).toBe(401);
  });

  it("never lets a promotion drive the charge to zero", async () => {
    // A fixed discount far above the plan price: the ceiling and the MIN_CHARGE floor must clamp
    // it, because a 0 ₺ charge would skip the e-Arşiv invoice.
    const code = `HUGE${RUN}`;
    await seedPromotion({ code, discountType: "FIXED", discountValue: 999_999 });

    const res = await request(app.getHttpServer())
      .post("/v1/subscription/offers")
      .set(auth(reader.token))
      .send({ code });

    const offer = res.body.offers["premium-monthly"];
    expect(offer.chargedPriceMinor).toBeGreaterThan(0);
    expect(offer.chargedPriceMinor + offer.discountMinor).toBe(LIST_PRICE);
    // promotions.max_percent = 50 caps a FIXED discount too.
    expect(offer.discountMinor).toBe(LIST_PRICE / 2);
  });
});
