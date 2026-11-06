import { randomUUID } from "node:crypto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Currency } from "@mentor/types";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { QuestService } from "../src/modules/economy/application/quest.service";
import { JobRunnerService } from "../src/modules/notifications/application/job-runner.service";
import {
  PaymentSucceeded,
  PaymentsEventTopic,
} from "../src/modules/payments/domain/payments.events";
import { signFakeWebhook } from "../src/modules/payments/infrastructure/adapters/fake-payments.adapter";
import request from "./browser-request";
import { economyAuditHarness } from "./fixtures/economy-audit";

describe("Economy earning audit (real HTTP/Postgres)", () => {
  let h: Awaited<ReturnType<typeof economyAuditHarness>>;
  let user: Awaited<ReturnType<typeof h.signup>>;
  const auth = (token = user.token) => ({ Authorization: `Bearer ${token}` });
  beforeAll(async () => {
    h = await economyAuditHarness();
  }, 90_000);
  beforeEach(async () => {
    await h.set("economy.enabled", true);
    await h.set("economy.coin.daily_cap", 50);
    await h.set("economy.coin.weekly_cap", 200);
    await h.set("economy.coin.min_xp_for_coin", 0);
    await h.set("economy.quest.weekly_allowance_active_days_target", 5);
    await h.set("economy.quest.weekly_allowance_reward_coin", 15);
    // Daily active-day Coin (2026-11-01) off here: these audits count onboarding + weekly only.
    await h.set("economy.quest.daily_active_reward_coin", 0);
    user = await h.signup();
  });
  afterAll(async () => {
    await h?.app.close();
    await h?.pool.end();
  });
  const grant = (amount: number) =>
    h.economy.grant(user.id, Currency.COIN, amount, {
      reason: "qa.organic",
      refType: "qa.organic",
      refId: randomUUID(),
    });

  it("serializes concurrent daily earnings and spending does not restore earning headroom", async () => {
    await h.set("economy.coin.daily_cap", 10);
    const results = await Promise.allSettled([grant(10), grant(10), grant(10)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results)
      if (r.status === "rejected")
        expect(r.reason.code).toBe("ECONOMY_LIMIT_EXCEEDED");
    await h.economy.spend(user.id, 5, {
      reason: "qa.spend",
      refType: "qa.spend",
      refId: randomUUID(),
    });
    await expect(grant(1)).rejects.toMatchObject({
      code: "ECONOMY_LIMIT_EXCEEDED",
    });
    expect((await h.economy.getAdminBalance(user.id)).coinConfirmed).toBe(5);
  });

  it("enforces the rolling weekly cap independently of today's cap", async () => {
    await h.set("economy.coin.daily_cap", 10);
    await h.set("economy.coin.weekly_cap", 15);
    // Historical ledger fixture tests the rolling window without changing the server clock.
    await h.tx(async (c) => {
      await c.query(
        `insert into ledger_entries(user_id,unit,amount,status,reason,created_at)
       values ($1,'COIN',10,'CONFIRMED','qa.historical',now()-interval '36 hours')`,
        [user.id],
      );
    });
    const results = await Promise.allSettled([grant(5), grant(5)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await h.economy.getAdminBalance(user.id)).coinConfirmed).toBe(15);
  });

  it("honors minimum XP and keeps admin adjustments outside organic cap consumption", async () => {
    await h.set("economy.coin.min_xp_for_coin", 10);
    await expect(grant(5)).rejects.toMatchObject({
      code: "ECONOMY_LIMIT_EXCEEDED",
    });
    await h.economy.grant(user.id, Currency.XP, 10, { reason: "qa.xp" });
    await h.set("economy.coin.daily_cap", 5);
    await h.economy.grant(user.id, Currency.COIN, 100, {
      reason: "admin.adjust",
      actorId: user.id,
      note: "QA correction",
      enforceLimits: false,
    });
    await grant(5);
    await expect(grant(1)).rejects.toMatchObject({
      code: "ECONOMY_LIMIT_EXCEEDED",
    });
    expect((await h.economy.getAdminBalance(user.id)).coinConfirmed).toBe(105);
  });

  it("localizes a pending Coin right, removes its action and clears the hint while economy is closed", async () => {
    await h.set("economy.coin.min_xp_for_coin", 1);
    await request(h.app.getHttpServer())
      .patch("/v1/users/me")
      .set(auth())
      .send({ examType: "KPSS" })
      .expect(200);
    const pending = await request(h.app.getHttpServer())
      .get("/v1/economy/quests")
      .set(auth())
      .set("Accept-Language", "en")
      .expect(200);
    expect(
      pending.body.find(
        (q: { id: string }) => q.id === "onboarding.profile-setup",
      ),
    ).toMatchObject({
      completed: false,
      action: null,
      rewardPendingMessage:
        "The step is complete. Your Coin reward is pending.",
    });
    await h.set("economy.enabled", false);
    const closed = await request(h.app.getHttpServer())
      .get("/v1/economy/quests")
      .set(auth())
      .expect(200);
    expect(
      closed.body.every(
        (q: { rewardUnit: string; rewardPendingMessage?: string }) =>
          q.rewardUnit === "NONE" && !q.rewardPendingMessage,
      ),
    ).toBe(true);
    await h.set("economy.enabled", true);
    await request(h.app.getHttpServer())
      .get("/v1/economy/quests")
      .set(auth())
      .expect(200);
    expect((await h.economy.getAdminBalance(user.id)).coinConfirmed).toBe(0);
  });

  it("requires five active dates, pays once per ISO week and never backpays a closed week", async () => {
    const quests = h.app.get(QuestService);
    await h.seedWeek(user.id, "2026-10-05", 4);
    await quests.evaluateAndGrant(user.id, "2026-10-08", true);
    expect((await h.economy.getAdminBalance(user.id)).coinConfirmed).toBe(0);
    await h.seedWeek(user.id, "2026-10-09", 1);
    await Promise.all(
      [1, 2, 3].map(() => quests.evaluateAndGrant(user.id, "2026-10-09", true)),
    );
    expect((await h.economy.getAdminBalance(user.id)).coinConfirmed).toBe(15);
    await h.seedWeek(user.id, "2026-10-12");
    await quests.evaluateAndGrant(user.id, "2026-10-16", true);
    expect((await h.economy.getAdminBalance(user.id)).coinConfirmed).toBe(30);
    await h.set("economy.enabled", false);
    await h.seedWeek(user.id, "2026-10-19");
    await quests.evaluateAndGrant(user.id, "2026-10-23", true);
    const before = await h.economy.getAdminBalance(user.id);
    await h.set("economy.enabled", true);
    await quests.evaluateAndGrant(user.id, "2026-10-23", true);
    expect(await h.economy.getAdminBalance(user.id)).toEqual(before);
    const rows = await h.pool.query(
      "select amount from ledger_entries where user_id=$1 and reason='quest.weekly.effort-allowance'",
      [user.id],
    );
    expect(rows.rows).toEqual([{ amount: 15 }, { amount: 15 }]);
  });

  it("records disabled invite payment delivery and reopening/replay cannot pay it", async () => {
    const invited = await h.signup();
    const code = await request(h.app.getHttpServer())
      .get("/v1/economy/invite")
      .set(auth())
      .expect(200);
    await request(h.app.getHttpServer())
      .post("/v1/economy/invite/redeem")
      .set(auth(invited.token))
      .send({ code: code.body.code })
      .expect(201);
    const checkout = await request(h.app.getHttpServer())
      .post("/v1/subscription/checkout")
      .set(auth(invited.token))
      .send({ planId: "premium-monthly", useTrial: false })
      .expect(200);
    const providerRef = new URL(checkout.body.checkoutUrl).searchParams.get(
      "ref",
    )!;
    const paymentId = `qa-disabled-${randomUUID()}`;
    await h.set("economy.enabled", false);
    const signed = signFakeWebhook("test-payments-webhook-secret", {
      eventId: paymentId,
      type: "payment_succeeded",
      providerRef,
      amountMinor: 24900,
    });
    await request(h.app.getHttpServer())
      .post("/v1/webhooks/payments")
      .set(signed.headers)
      .send(JSON.parse(signed.body))
      .expect(200);
    const rewardJobs = await h.pool.query(
      "select id from jobs where name='payments.deliver-reward-event' and payload->'event'->>'paymentId'=$1",
      [paymentId],
    );
    expect(rewardJobs.rows).toHaveLength(1);
    const runner = h.app.get(JobRunnerService);
    // The shared test DB can have older jobs, and the background worker can claim this one.
    await expect
      .poll(
        async () => {
          await runner.processBatch(100);
          const redemption = await h.pool.query(
            "select status,reward_outcome,source_payment_id from invite_redemptions where invited_user_id=$1",
            [invited.id],
          );
          return redemption.rows[0];
        },
        { timeout: 10_000 },
      )
      .toMatchObject({
        status: "CONVERTED",
        reward_outcome: "DISABLED",
        source_payment_id: paymentId,
      });
    expect((await h.economy.getAdminBalance(user.id)).coinConfirmed).toBe(0);
    await h.set("economy.enabled", true);
    await h.app
      .get(EventEmitter2)
      .emitAsync(
        PaymentsEventTopic.PAYMENT_SUCCEEDED,
        new PaymentSucceeded(
          invited.id,
          randomUUID(),
          paymentId,
          24900,
          new Date(),
        ),
      );
    expect((await h.economy.getAdminBalance(user.id)).coinConfirmed).toBe(0);
  });
});
