import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerStorage } from "@nestjs/throttler";
import { UserRole } from "@mentor/types";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { withServiceContext } from "../src/database/rls";
import { users } from "../src/database/schema";
import { AdminAuditService } from "../src/modules/admin/application/admin-audit.service";
import { UsersService } from "../src/modules/identity/application/users.service";
import { TurnstileService } from "../src/modules/identity/application/turnstile.service";
import { NetgsmSmsAdapter } from "../src/modules/identity/infrastructure/netgsm-sms.adapter";
import { PhoneTestHarness, TEST_PHONE_FINGERPRINT_SECRET, TEST_PHONE_OTP_SECRET } from "./phone-test-harness";

describe("admin phone collision on reactivation (e2e)", () => {
  let app: INestApplication;
  let harness: PhoneTestHarness;
  let sentCode = "";
  const audit = { record: vi.fn(async () => undefined) };

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    process.env.SMS_PROVIDER = "disabled";
    process.env.PHONE_OTP_SECRET = TEST_PHONE_OTP_SECRET;
    process.env.PHONE_FINGERPRINT_SECRET = TEST_PHONE_FINGERPRINT_SECRET;
    process.env.PAYMENTS_PROVIDER = "fake";
    const { AppModule } = await import("../src/app.module");
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AdminAuditService).useValue(audit)
      .overrideProvider(NetgsmSmsAdapter).useValue({
        isAvailable: () => true,
        sendCode: async (_phone: string, code: string) => { sentCode = code; return { status: "SENT" }; },
      })
      .overrideProvider(TurnstileService).useValue({ assertValid: vi.fn(async () => undefined) })
      .overrideProvider(ThrottlerStorage).useValue({
        increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }),
      })
      .compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    await app.init();
    harness = new PhoneTestHarness(app);
    await harness.account();
    await harness.set("identity.phone.enabled", true);
  }, 120_000);

  afterAll(async () => { await harness?.clean(); await app?.close(); });

  it("returns a localized 409 and keeps A suspended after B verifies A's former phone", async () => {
    const admin = harness.accounts[0]!;
    await app.get(UsersService).setRoles(admin.id, () => [UserRole.ADMIN]);
    const a = await harness.account();
    const b = await harness.account();
    const bindA = await harness.send(a);
    expect(bindA.status).toBe(201);
    expect((await harness.confirm(a, bindA.body.challengeId, sentCode)).status).toBe(200);

    const suspend = await request(app.getHttpServer()).patch(`/v1/admin/users/${a.id}/status`)
      .set("Authorization", `Bearer ${admin.accessToken}`).send({ status: "SUSPENDED" });
    expect(suspend.status).toBe(200);

    const bindB = await harness.send(b, a.phone);
    expect(bindB.status).toBe(201);
    expect((await harness.confirm(b, bindB.body.challengeId, sentCode)).status).toBe(200);

    for (const [language, message] of [
      ["tr", "Bu numara bu hesapta kullanılamıyor."],
      ["en", "This number cannot be used on this account."],
    ] as const) {
      const reactivate = await request(app.getHttpServer()).patch(`/v1/admin/users/${a.id}/status`)
        .set("Authorization", `Bearer ${admin.accessToken}`).set("Accept-Language", language)
        .send({ status: "ACTIVE" });
      expect(reactivate.status).toBe(409);
      expect(reactivate.body).toMatchObject({ code: "AUTH_PHONE_UNAVAILABLE", message });
      expect(reactivate.body).not.toHaveProperty("details");
      expect(JSON.stringify(reactivate.body)).not.toContain(a.phone);
    }
    expect(audit.record).toHaveBeenCalledTimes(1);

    await withServiceContext(harness.db, async (tx) => {
      const [former] = await tx.select({ status: users.status }).from(users).where(eq(users.id, a.id));
      const [current] = await tx.select({ status: users.status, phone: users.phoneNumber, verified: users.phoneVerifiedAt })
        .from(users).where(eq(users.id, b.id));
      expect(former!.status).toBe("SUSPENDED");
      expect(current!.status).toBe("ACTIVE");
      expect(current!.phone === a.phone).toBe(true);
      expect(current!.verified).not.toBeNull();
    });
  });
});
