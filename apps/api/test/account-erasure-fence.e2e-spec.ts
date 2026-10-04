import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerStorage } from "@nestjs/throttler";
import * as argon2 from "argon2";
import cookieParser from "cookie-parser";
import { eq, inArray } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { withServiceContext } from "../src/database/rls";
import { subscriptions, users } from "../src/database/schema";
import { phoneTrialClaims } from "../src/database/schema-phone-trials";
import { PAYMENTS_PORT } from "../src/shared/ports/payments.port";
import { AccountErasureService } from "../src/modules/account/application/account-erasure.service";
import { AiErasureService } from "../src/modules/ai/application/ai-erasure.service";
import { UsersService } from "../src/modules/identity/application/users.service";
import { UsersRepository } from "../src/modules/identity/infrastructure/users.repository";
import { PhoneVerificationService } from "../src/modules/identity/application/phone-verification.service";
import { PhoneVerificationRepository } from "../src/modules/identity/infrastructure/phone-verification.repository";
import { NetgsmSmsAdapter } from "../src/modules/identity/infrastructure/netgsm-sms.adapter";
import { TurnstileService } from "../src/modules/identity/application/turnstile.service";
import { CheckoutService } from "../src/modules/payments/application/checkout.service";
import { PhoneTrialsRepository } from "../src/modules/payments/infrastructure/phone-trials.repository";
import { PlansRepository, SubscriptionsRepository } from "../src/modules/payments/infrastructure/payments.repositories";
import { PhoneTestHarness, TEST_PHONE_FINGERPRINT_SECRET, TEST_PHONE_OTP_SECRET } from "./phone-test-harness";

function barrier() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

/** Real identity/session/checkout transactions, with local provider fakes and explicit race barriers. */
describe("account erasure fence (Postgres/API)", () => {
  let app: INestApplication;
  let harness: PhoneTestHarness;
  const provider = { provider: "FAKE", instantCheckout: false,
    createCheckout: vi.fn(async () => ({ providerRef: "fence-provider", checkoutUrl: "https://pay.test/fence" })),
    cancel: vi.fn(async () => undefined) };
  const sms = { isAvailable: () => true, sendCode: vi.fn(async () => ({ status: "SENT" })) };
  const fingerprints: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    if (!new URL(process.env.DATABASE_URL).pathname.endsWith("_test")) throw new Error("A dedicated _test database is required");
    process.env.SMS_PROVIDER = "disabled";
    process.env.PHONE_OTP_SECRET = TEST_PHONE_OTP_SECRET;
    process.env.PHONE_FINGERPRINT_SECRET = TEST_PHONE_FINGERPRINT_SECRET;
    process.env.PAYMENTS_PROVIDER = "fake";
    const { AppModule } = await import("../src/app.module");
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PAYMENTS_PORT).useValue(provider)
      .overrideProvider(NetgsmSmsAdapter).useValue(sms)
      .overrideProvider(TurnstileService).useValue({ assertValid: async () => undefined })
      .overrideProvider(ThrottlerStorage).useValue({ increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }) })
      .compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();
    harness = new PhoneTestHarness(app);
    await harness.account();
    await harness.set("identity.phone.enabled", true);
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    if (harness) {
      await withServiceContext(harness.db, async (tx) => {
        if (fingerprints.length) await tx.delete(phoneTrialClaims).where(inArray(phoneTrialClaims.phoneFingerprint, fingerprints));
        await tx.delete(subscriptions).where(inArray(subscriptions.userId, harness.accounts.map((account) => account.id)));
      });
      await harness.clean();
    }
    await app?.close();
  });

  async function verifiedAccount() {
    const user = await harness.account();
    await app.get(UsersRepository).updateService(user.id, { phoneNumber: user.phone,
      phoneVerifiedAt: new Date(), emailVerifiedAt: new Date() });
    fingerprints.push((await app.get(UsersService).getVerifiedPhoneFingerprint(user.id))!);
    return user;
  }

  async function checkoutInput(id: string, withTrial: boolean) {
    const plan = (await app.get(PlansRepository).findById("premium-monthly"))!;
    return { user: { id, email: `phone-${id}@test.local`, createdAt: new Date() }, plan, withTrial, useTrial: withTrial,
      offer: { planId: plan.id, listPriceMinor: plan.priceMinor, discountMinor: 0, chargedPriceMinor: plan.priceMinor,
        renewalPriceMinor: plan.priceMinor, promotionId: null, summary: null, reason: null }, returnUrl: "https://app.test/result" };
  }

  it("blocks already-authorized paid and trial checkout after cancellation, before scrub, without a provider call", async () => {
    const user = await verifiedAccount();
    await app.get(SubscriptionsRepository).create({ userId: user.id, planId: "premium-monthly", status: "ACTIVE",
      provider: "FAKE", providerRef: `cancel-${user.id}`, currentPeriodEnd: new Date(Date.now() + 86_400_000) });
    const paused = barrier(); const resume = barrier();
    const ai = vi.spyOn(app.get(AiErasureService), "eraseUserData").mockImplementationOnce(async () => {
      paused.resolve(); await resume.promise;
    });
    const erasing = app.get(AccountErasureService).eraseAccount(user.id, "DELETED");
    await paused.promise;
    try {
      expect(provider.cancel).toHaveBeenCalledWith(`cancel-${user.id}`);
      expect(await app.get(UsersRepository).findByIdService(user.id)).toMatchObject({ status: "ACTIVE", erasureStartedAt: expect.any(Date) });
      provider.createCheckout.mockClear();
      for (const withTrial of [false, true]) {
        await expect(app.get(CheckoutService).start(await checkoutInput(user.id, withTrial)))
          .rejects.toMatchObject({ code: "PAYMENT_TRIAL_PENDING" });
      }
      expect(provider.createCheckout).not.toHaveBeenCalled();
    } finally { resume.resolve(); await erasing; ai.mockRestore(); }
    expect(await app.get(UsersRepository).findByIdService(user.id)).toMatchObject({ status: "DELETED", erasureStartedAt: null });
  });

  it("denies login, issuance, refresh, sessions and phone operations during erasure, including an earlier authorized principal", async () => {
    const user = await verifiedAccount();
    const repo = app.get(UsersRepository);
    const row = (await repo.updateService(user.id, { passwordHash: await argon2.hash("Sifre1234") }))!;
    const principal = await harness.tokens.validateSession(user.sessionId, user.id);
    const startedAt = await app.get(UsersService).beginAccountErasure(user.id);
    try {
      expect((await request(app.getHttpServer()).post("/v1/auth/login").send({ email: row.email, password: "Sifre1234" })).status).toBe(401);
      await expect(harness.tokens.issue(row)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(harness.tokens.validateSession(user.sessionId, user.id)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect((await harness.status(user)).status).toBe(401);
      const phone = app.get(PhoneVerificationService);
      sms.sendCode.mockClear();
      await expect(phone.getStatus(principal)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(phone.requestVerification(principal, { phoneNumber: "+905339999999" }))
        .rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(phone.confirmVerification(principal, "11111111-1111-4111-8111-111111111111", "123456"))
        .rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(sms.sendCode).not.toHaveBeenCalled();
      expect(await app.get(PhoneVerificationRepository).getState(user.id, user.sessionId)).toBeNull();
      expect(await app.get(UsersService).isEmailVerified(user.id)).toBe(false);
      expect(await app.get(UsersService).getVerifiedPhoneFingerprint(user.id)).toBeNull();
      expect(await app.get(UsersService).getVerifiedNotificationContact(user.id)).toBeNull();
      expect((await request(app.getHttpServer()).post("/v1/auth/refresh")
        .set("Cookie", `mentor_web_refresh=${user.refreshToken}`)).status).toBe(401);
    } finally { await app.get(UsersService).releaseAccountErasure(user.id, startedAt); }
  });

  it("retains an unknown pending checkout and behavior, releases only its fence and restores availability", async () => {
    const user = await verifiedAccount();
    provider.createCheckout.mockRejectedValueOnce(new Error("provider timeout"));
    await expect(app.get(CheckoutService).start(await checkoutInput(user.id, true)))
      .rejects.toMatchObject({ code: "PAYMENT_TRIAL_PENDING" });
    const ai = vi.spyOn(app.get(AiErasureService), "eraseUserData");
    try {
      await expect(app.get(AccountErasureService).eraseAccount(user.id, "DELETED"))
        .rejects.toMatchObject({ code: "PAYMENT_TRIAL_PENDING" });
      expect(ai).not.toHaveBeenCalled();
      expect(await app.get(PhoneTrialsRepository).findPendingForUser(user.id))
        .toMatchObject({ userId: user.id, status: "PENDING", expiresAt: null });
      expect(await app.get(SubscriptionsRepository).findOpenForUser(user.id)).toMatchObject({ status: "INCOMPLETE", providerRef: null });
      expect(await app.get(UsersRepository).findByIdService(user.id))
        .toMatchObject({ status: "ACTIVE", erasureStartedAt: null, phoneNumber: user.phone });
      expect((await harness.status(user)).status).toBe(200);
      await expect(harness.tokens.rotate(user.refreshToken)).resolves.toBeDefined();
    } finally { ai.mockRestore(); }
  });

  it("keeps a crash fence durable, rejects concurrent owners and ignores release with a stale timestamp", async () => {
    const user = await verifiedAccount();
    const identity = app.get(UsersService);
    const startedAt = await identity.beginAccountErasure(user.id);
    await expect(identity.beginAccountErasure(user.id)).rejects.toMatchObject({ code: "CONFLICT", httpStatus: 409 });
    await identity.releaseAccountErasure(user.id, new Date(startedAt.getTime() - 1));
    expect(await app.get(UsersRepository).findByIdService(user.id)).toMatchObject({ erasureStartedAt: startedAt, status: "ACTIVE" });
    await identity.releaseAccountErasure(user.id, startedAt);
    expect((await harness.status(user)).status).toBe(200);
  });

  it("retains active phone uniqueness while fenced and never changes status on release", async () => {
    const user = await verifiedAccount(); const other = await harness.account();
    const identity = app.get(UsersService);
    const startedAt = await identity.beginAccountErasure(user.id);
    try {
      await expect(app.get(UsersRepository).updateService(other.id, { phoneNumber: user.phone, phoneVerifiedAt: new Date() }))
        .rejects.toBeDefined();
      await withServiceContext(harness.db, (tx) => tx.update(users).set({ status: "SUSPENDED" }).where(eq(users.id, user.id)));
    } finally { await identity.releaseAccountErasure(user.id, startedAt); }
    expect(await app.get(UsersRepository).findByIdService(user.id)).toMatchObject({ status: "SUSPENDED", erasureStartedAt: null });
  });
});
