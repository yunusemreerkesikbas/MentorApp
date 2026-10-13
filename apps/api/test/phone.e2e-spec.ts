import { disableAuthRateLimits } from "./app-harness";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "./browser-request";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ThrottlerStorage } from "@nestjs/throttler";
import { and, eq, gte, sql } from "drizzle-orm";
import { NetgsmSmsAdapter, type SmsSendResult } from "../src/modules/identity/infrastructure/netgsm-sms.adapter";
import { TurnstileService } from "../src/modules/identity/application/turnstile.service";
import { PhoneTestHarness, TEST_PHONE_FINGERPRINT_SECRET, TEST_PHONE_OTP_SECRET } from "./phone-test-harness";
import { withServiceContext } from "../src/database/rls";
import { phoneOtpAttempts, phoneVerifications } from "../src/database/schema-phone";
import { users } from "../src/database/schema";
import { UsersService } from "../src/modules/identity/application/users.service";

describe("private phone verification boundary (e2e)", () => {
  let app: INestApplication;
  let harness: PhoneTestHarness;
  const sent: { phone: string; code: string }[] = [];
  let sendStatus: SmsSendResult["status"] = "SENT";
  const turnstile = { assertValid: vi.fn(async () => undefined) };
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    process.env.SMS_PROVIDER = "disabled";
    process.env.PHONE_OTP_SECRET = TEST_PHONE_OTP_SECRET;
    process.env.PHONE_FINGERPRINT_SECRET = TEST_PHONE_FINGERPRINT_SECRET;
    process.env.PAYMENTS_PROVIDER = "fake";
    const { AppModule } = await import("../src/app.module");
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(NetgsmSmsAdapter).useValue({ isAvailable: () => true,
        sendCode: async (phone: string, code: string) => { sent.push({ phone, code }); return { status: sendStatus }; } })
      .overrideProvider(TurnstileService).useValue(turnstile)
      .overrideProvider(ThrottlerStorage).useValue({ increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }) })
      .compile();
    disableAuthRateLimits(module);
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    await app.init();
    harness = new PhoneTestHarness(app);
    await harness.account();
    await harness.set("identity.phone.enabled", true);
  }, 120_000);
  afterAll(async () => { await harness?.clean(); await app?.close(); });

  it("requires authentication for every phone route", async () => {
    for (const [method, url] of [
      ["get", "/v1/users/me/phone"],
      ["post", "/v1/users/me/phone/verifications"],
      ["post", "/v1/users/me/phone/verifications/00000000-0000-4000-8000-000000000000/confirm"],
    ] as const) {
      const result = await request(app.getHttpServer())[method](url).send({});
      expect(result.status).toBe(401);
    }
  });

  it("binds a private phone once and atomically rejects a concurrent code replay", async () => {
    const user = await harness.account();
    const challenge = await harness.send(user);
    expect(challenge.status).toBe(201);
    expect(JSON.stringify(challenge.body)).not.toContain(user.phone);
    const code = sent.at(-1)!.code;
    const results = await Promise.all([harness.confirm(user, challenge.body.challengeId, code),
      harness.confirm(user, challenge.body.challengeId, code)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    expect((await harness.status(user)).body).toMatchObject({ verified: true, available: true, reauthenticationRequired: false });
    const me = await request(app.getHttpServer()).get("/v1/users/me").set("Authorization", `Bearer ${user.accessToken}`);
    expect(JSON.stringify(me.body)).not.toContain(user.phone);
    expect(turnstile.assertValid).toHaveBeenCalledWith(undefined, "phone-verification");
  });

  it("rejects foreign/fixed-line numbers before spending an SMS", async () => {
    const user = await harness.account();
    const before = sent.length;
    for (const phone of ["+15551234567", "02121234567"]) expect((await harness.send(user, phone)).status).toBe(400);
    expect(sent).toHaveLength(before);
  });

  it("rejects wrong-account, wrong-session and expired challenges", async () => {
    const user = await harness.account();
    const other = await harness.account();
    const challenge = await harness.send(user);
    const code = sent.at(-1)!.code;
    expect((await harness.confirm(other, challenge.body.challengeId, code)).status).toBe(400);
    const freshTokens = await harness.tokens.issue({ id: user.id, roles: ["STUDENT"], organizationId: null });
    expect((await harness.confirm({ ...user, accessToken: freshTokens.accessToken }, challenge.body.challengeId, code)).status).toBe(400);
    await withServiceContext(harness.db, async (tx) => {
      await tx.update(phoneVerifications).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(phoneVerifications.id, challenge.body.challengeId));
    });
    const expired = await harness.confirm(user, challenge.body.challengeId, code);
    expect(expired.body.code).toBe("AUTH_PHONE_CODE_EXPIRED");
  });

  it("enforces cooldown and invalidates the previous challenge on resend", async () => {
    const user = await harness.account();
    const first = await harness.send(user);
    const firstCode = sent.at(-1)!.code;
    expect((await harness.send(user)).status).toBe(429);
    await harness.allowResend(user);
    const second = await harness.send(user);
    const nextCode = sent.at(-1)!.code;
    expect((await harness.confirm(user, first.body.challengeId, firstCode)).status).toBe(400);
    expect((await harness.confirm(user, second.body.challengeId, nextCode)).status).toBe(200);
  });

  it("commits wrong attempts and does not reset the daily failure quota on resend", async () => {
    const user = await harness.account();
    await harness.set("identity.phone.failed_daily_limit", 5);
    const first = await harness.send(user);
    const code = sent.at(-1)!.code;
    const wrong = code === "000000" ? "111111" : "000000";
    for (let n = 0; n < 5; n++) expect((await harness.confirm(user, first.body.challengeId, wrong)).status).toBe(400);
    expect((await harness.confirm(user, first.body.challengeId, code)).status).toBe(429);
    await harness.allowResend(user);
    const second = await harness.send(user);
    expect((await harness.confirm(user, second.body.challengeId, sent.at(-1)!.code)).status).toBe(429);
    await harness.set("identity.phone.failed_daily_limit", 20);
  });

  it("keeps one verified number on one ACTIVE account", async () => {
    const a = await harness.account(); const b = await harness.account();
    const first = await harness.send(a); const firstCode = sent.at(-1)!.code;
    const second = await harness.send(b, a.phone); const secondCode = sent.at(-1)!.code;
    const results = await Promise.all([harness.confirm(a, first.body.challengeId, firstCode), harness.confirm(b, second.body.challengeId, secondCode)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it("keeps number send quotas after account erasure and prevents account/number switching", async () => {
    const a = await harness.account(); const b = await harness.account();
    await harness.set("identity.phone.send_daily_limit", 1);
    expect((await harness.send(a)).status).toBe(201);
    await harness.allowResend(a);
    expect((await harness.send(a, b.phone)).status).toBe(429);
    await app.get(UsersService).anonymizeAccount(a.id, "DELETED");
    expect((await harness.send(b, a.phone)).status).toBe(429);
    await harness.set("identity.phone.send_daily_limit", 10);
  });

  it("serializes concurrent daily and monthly global budget reservations", async () => {
    for (const window of ["day", "month"] as const) {
      const now = new Date();
      const since = window === "day" ? new Date(now.getTime() - 86_400_000)
        : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const [count] = await withServiceContext(harness.db, (tx) => tx.select({ count: sql<number>`count(*)::int` })
        .from(phoneOtpAttempts).where(and(eq(phoneOtpAttempts.kind, "SEND"), gte(phoneOtpAttempts.createdAt, since))));
      const key = window === "day" ? "identity.phone.global_daily_limit" : "identity.phone.global_monthly_limit";
      await harness.set(key, count!.count + 1);
      const a = await harness.account(); const b = await harness.account();
      const results = await Promise.all([harness.send(a), harness.send(b)]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 429]);
      await harness.set(key, window === "day" ? 100 : 1000);
    }
  });

  it("keeps the old number until replacement and requires recent login, not refresh", async () => {
    const user = await harness.account();
    const first = await harness.send(user);
    expect((await harness.confirm(user, first.body.challengeId, sent.at(-1)!.code)).status).toBe(200);
    await harness.ageSession(user);
    const refreshed = await harness.tokens.rotate(user.refreshToken);
    const oldSession = { ...user, accessToken: refreshed.tokens.accessToken };
    expect((await harness.status(oldSession)).body.reauthenticationRequired).toBe(true);
    expect((await harness.send(oldSession, "+905330000099")).status).toBe(403);
    const fresh = await harness.tokens.issue({ id: user.id, roles: ["STUDENT"], organizationId: null });
    const freshUser = { ...user, accessToken: fresh.accessToken };
    await harness.allowResend(user);
    const replacement = await harness.send(freshUser, "+905330000099");
    expect(replacement.status).toBe(201);
    expect((await harness.status(freshUser)).body.maskedPhoneNumber).toContain(user.phone.slice(-2));
    expect((await harness.confirm(freshUser, replacement.body.challengeId, sent.at(-1)!.code)).status).toBe(200);
    expect((await harness.status(freshUser)).body.maskedPhoneNumber).toContain("99");
  });

  it("allows a received code after ambiguous delivery, but rejects definite send failure", async () => {
    const user = await harness.account();
    sendStatus = "UNKNOWN";
    const unknown = await harness.send(user);
    expect(unknown.body.sendStatus).toBe("UNKNOWN");
    expect((await harness.confirm(user, unknown.body.challengeId, sent.at(-1)!.code)).status).toBe(200);
    const failedUser = await harness.account();
    sendStatus = "FAILED";
    expect((await harness.send(failedUser)).status).toBe(503);
    const [failed] = await withServiceContext(harness.db, (tx) => tx.select().from(phoneVerifications).where(eq(phoneVerifications.userId, failedUser.id)));
    expect((await harness.confirm(failedUser, failed!.id, sent.at(-1)!.code)).status).toBe(400);
    sendStatus = "SENT";
  });

  it("fails closed while disabled and removes private phone state on erasure", async () => {
    const user = await harness.account();
    const first = await harness.send(user);
    const code = sent.at(-1)!.code;
    await harness.set("identity.phone.enabled", false);
    expect((await harness.confirm(user, first.body.challengeId, code)).status).toBe(503);
    expect((await harness.send(user)).status).toBe(503);
    await harness.set("identity.phone.enabled", true);
    expect((await harness.confirm(user, first.body.challengeId, code)).status).toBe(200);
    await app.get(UsersService).anonymizeAccount(user.id, "DELETED");
    const [row] = await withServiceContext(harness.db, (tx) => tx.select().from(users).where(eq(users.id, user.id)));
    expect(row).toMatchObject({ phoneNumber: null, phoneVerifiedAt: null });
    const outstanding = await withServiceContext(harness.db, (tx) => tx.select().from(phoneVerifications).where(eq(phoneVerifications.userId, user.id)));
    expect(outstanding).toEqual([]);
  });
});
