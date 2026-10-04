import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDatabase, type DatabaseTx } from "../src/database/drizzle";
import { withServiceContext } from "../src/database/rls";
import { CheckoutService } from "../src/modules/payments/application/checkout.service";
import { PhoneTrialService } from "../src/modules/payments/application/phone-trial.service";
import { PhoneTrialsRepository } from "../src/modules/payments/infrastructure/phone-trials.repository";
import { PlansRepository, SubscriptionsRepository } from "../src/modules/payments/infrastructure/payments.repositories";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

/** Real account row locks, subscriptions, claims and transactions; provider HTTP is gated locally. */
describe("checkout reservations (Postgres)", () => {
  let pool: Pool;
  let db: ReturnType<typeof createDatabase>;
  const userIds: string[] = [];
  beforeAll(() => {
    const url = process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    if (!new URL(url).pathname.endsWith("_test")) throw new Error("A dedicated _test database is required");
    pool = new Pool({ connectionString: url });
    db = createDatabase(pool);
  });
  afterAll(async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.role','SERVICE',true)");
      await client.query("delete from phone_trial_claims where user_id = any($1::uuid[])", [userIds]);
      await client.query("delete from users where id = any($1::uuid[])", [userIds]);
      await client.query("commit");
    } finally { client.release(); await pool.end(); }
  });

  it.each([true, false])("serializes real paid/trial reservations while the first provider request is in flight (trial=%s)", async (withTrial) => {
    const id = randomUUID();
    userIds.push(id);
    await withServiceContext(db, (tx) => tx.execute(sql`insert into users(id,email,password_hash,display_name,kvkk_accepted_at,terms_accepted_at,age_eligibility_confirmed_at)
      values (${id}, ${id + "@checkout.test"}, 'test', 'Checkout test', now(), now(), now())`));
    const subscriptions = new SubscriptionsRepository(db);
    const claims = new PhoneTrialsRepository(db);
    const lockActiveAccount = async (userId: string, tx: DatabaseTx) => {
      const found = await tx.execute(sql`select id from users where id = ${userId} and status = 'ACTIVE' for no key update`);
      return found.rows.length > 0;
    };
    const users = { lockActiveAccount, getVerifiedPhoneFingerprint: async (userId: string, tx?: DatabaseTx) => {
      if (tx && !(await lockActiveAccount(userId, tx))) return null;
      return `checkout-test-${id}`;
    } };
    const trials = new PhoneTrialService(db, users as never, claims, subscriptions);
    const plan = (await new PlansRepository(db).findById("premium-monthly"))!;
    expect(plan).toBeDefined();
    const called = deferred<void>();
    const result = deferred<{ providerRef: string; checkoutUrl: string }>();
    const provider = { provider: "FAKE", instantCheckout: false, createCheckout: vi.fn(async () => {
      expect((await subscriptions.findOpenForUser(id))?.status).toBe("INCOMPLETE");
      called.resolve();
      return result.promise;
    }) };
    const service = new CheckoutService(db, subscriptions, { reserve: vi.fn(), voidForSubscription: vi.fn() } as never,
      trials, provider as never, users as never, { emit: vi.fn() } as never);
    const input = { user: { id, email: id + "@checkout.test", createdAt: new Date() }, plan,
      offer: { planId: plan.id, listPriceMinor: plan.priceMinor, discountMinor: 0, chargedPriceMinor: plan.priceMinor,
        renewalPriceMinor: plan.priceMinor, promotionId: null, summary: null, reason: null }, returnUrl: "https://app.test/result" };
    const first = service.start({ ...input, withTrial, useTrial: withTrial });
    await called.promise;
    try {
      await expect(service.start({ ...input, withTrial: !withTrial, useTrial: !withTrial }))
        .rejects.toMatchObject({ code: "PAYMENT_TRIAL_PENDING" });
      expect(provider.createCheckout).toHaveBeenCalledTimes(1);
      const open = await subscriptions.findOpenForUser(id);
      expect(open?.status).toBe("INCOMPLETE");
      expect(Boolean(open?.trialEndsAt)).toBe(withTrial);
      expect(Boolean(await claims.findPendingForUser(id))).toBe(withTrial);
    } finally {
      result.resolve({ providerRef: `ref-${id}`, checkoutUrl: "https://pay.test/original" });
      await first;
    }
    expect(await service.start({ ...input, withTrial, useTrial: withTrial }))
      .toEqual({ checkoutUrl: "https://pay.test/original" });
    expect(provider.createCheckout).toHaveBeenCalledTimes(1);
  });
});
