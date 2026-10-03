import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { eq, inArray, sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { withServiceContext } from "../src/database/rls";
import { coachStudents, subscriptions, users } from "../src/database/schema";
import { UsersService } from "../src/modules/identity/application/users.service";
import { MentorshipLinkService } from "../src/modules/mentorship/application/mentorship-link.service";
import { MentorshipErasureService } from "../src/modules/mentorship/application/mentorship-erasure.service";
import { MentorshipLinkRepository } from "../src/modules/mentorship/infrastructure/mentorship-link.repository";
import { SponsoredSeatService } from "../src/modules/payments/application/sponsored-seat.service";
import { SubscriptionsRepository } from "../src/modules/payments/infrastructure/payments.repositories";
import { PhoneTestHarness, TEST_PHONE_FINGERPRINT_SECRET, TEST_PHONE_OTP_SECRET } from "./phone-test-harness";

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

describe("sponsored seat relationship races (e2e)", () => {
  let app: INestApplication;
  let harness: PhoneTestHarness;
  let seats: SponsoredSeatService;
  let links: MentorshipLinkService;
  let subscriptionsRepo: SubscriptionsRepository;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    process.env.SMS_PROVIDER = "disabled";
    process.env.PHONE_OTP_SECRET = TEST_PHONE_OTP_SECRET;
    process.env.PHONE_FINGERPRINT_SECRET = TEST_PHONE_FINGERPRINT_SECRET;
    process.env.PAYMENTS_PROVIDER = "fake";
    const { AppModule } = await import("../src/app.module");
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    await app.init();
    harness = new PhoneTestHarness(app);
    await harness.account();
    await harness.set("mentorship.enabled", true);
    await harness.set("mentorship.seats.sponsorship_enabled", true);
    seats = app.get(SponsoredSeatService);
    links = app.get(MentorshipLinkService);
    subscriptionsRepo = app.get(SubscriptionsRepository);
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    if (harness) {
      const ids = harness.accounts.map((account) => account.id);
      await withServiceContext(harness.db, async (tx) => {
        await tx.delete(subscriptions).where(inArray(subscriptions.userId, ids));
        await tx.delete(coachStudents).where(inArray(coachStudents.studentId, ids));
      });
      await harness.clean();
    }
    await app?.close();
  });

  async function fixture() {
    const coach = await harness.account();
    const student = await harness.account();
    const link = await withServiceContext(harness.db, async (tx) => {
      for (const account of [coach, student]) {
        await tx.update(users).set({ phoneNumber: account.phone, phoneVerifiedAt: new Date(), emailVerifiedAt: new Date() })
          .where(eq(users.id, account.id));
      }
      const [row] = await tx.insert(coachStudents).values({ coachId: coach.id, studentId: student.id,
        status: "ACTIVE", source: "INVITE", seat: "FREE", acceptedAt: new Date() }).returning();
      return row!;
    });
    return { coach, student, link };
  }

  it("a delayed grant cannot create Premium after student END and revoke have completed", async () => {
    const { coach, student, link } = await fixture();
    const paused = barrier();
    const resume = barrier();
    const identity = app.get(UsersService);
    const original = identity.isPhoneVerified.bind(identity);
    const spy = vi.spyOn(identity, "isPhoneVerified").mockImplementation(async (id, tx) => {
      if (id === student.id) { paused.release(); await resume.promise; }
      return original(id, tx);
    });
    const grant = seats.grant(student.id, link.id, coach.id);
    try {
      await paused.promise;
      await links.endByStudent(student.id);
      // Revoke has no row to expire at this point. The delayed transaction must recheck the link.
      expect(await seats.revoke(link.id)).toBe(false);
      resume.release();
      expect(await grant).toBe(false);
      expect(await subscriptionsRepo.findOpenForUser(student.id)).toBeUndefined();
    } finally { resume.release(); await grant; spy.mockRestore(); }
  });

  it("END waits for a grant holding the link row, then revokes the committed sponsorship", async () => {
    const { coach, student, link } = await fixture();
    const inserting = barrier();
    const resume = barrier();
    const original = subscriptionsRepo.create.bind(subscriptionsRepo);
    const spy = vi.spyOn(subscriptionsRepo, "create").mockImplementation(async (data, tx) => {
      if (data.sponsorLinkId === link.id) { inserting.release(); await resume.promise; }
      return original(data, tx);
    });
    const grant = seats.grant(student.id, link.id, coach.id);
    try {
      await inserting.promise;
      // This is the same END mutation, on a separate connection. A bounded lock timeout proves
      // the grant holds the relationship row, instead of relying on scheduler timing.
      await expect(withServiceContext(harness.db, async (tx) => {
        await tx.execute(sql`set local lock_timeout = '200ms'`);
        await app.get(MentorshipLinkRepository).endInTransaction(tx, link.id, student.id);
      })).rejects.toMatchObject({ cause: { code: "55P03" } });
      resume.release();
      expect(await grant).toBe(true);
      await links.endByStudent(student.id);
      await vi.waitFor(async () => {
        expect(await subscriptionsRepo.findOpenForUser(student.id)).toBeUndefined();
      });
      const rows = await withServiceContext(harness.db, (tx) => tx.select().from(subscriptions)
        .where(eq(subscriptions.sponsorLinkId, link.id)));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("EXPIRED");
    } finally { resume.release(); await grant; spy.mockRestore(); }
  });

  it("coach erasure revokes funded links and fences delayed grants before removing link associations", async () => {
    const { coach, student, link } = await fixture();
    expect(await seats.grant(student.id, link.id, coach.id)).toBe(true);
    const pending = await harness.account();
    const payer = await harness.account();
    const { pendingLink, paid } = await withServiceContext(harness.db, async (tx) => {
      await tx.update(users).set({ phoneNumber: pending.phone, phoneVerifiedAt: new Date() })
        .where(eq(users.id, pending.id));
      const [pendingLink] = await tx.insert(coachStudents).values({ coachId: coach.id, studentId: pending.id,
        status: "ACTIVE", source: "INVITE", seat: "FREE", acceptedAt: new Date() }).returning();
      await tx.insert(coachStudents).values({ coachId: coach.id, studentId: payer.id,
        status: "ACTIVE", source: "INVITE", seat: "SELF", acceptedAt: new Date() });
      const [paid] = await tx.insert(subscriptions).values({ userId: payer.id, planId: "premium-monthly",
        status: "ACTIVE", provider: "FAKE", currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) }).returning();
      return { pendingLink: pendingLink!, paid: paid! };
    });
    const paused = barrier();
    const resume = barrier();
    const identity = app.get(UsersService);
    const original = identity.isPhoneVerified.bind(identity);
    const spy = vi.spyOn(identity, "isPhoneVerified").mockImplementation(async (id, tx) => {
      if (id === pending.id) { paused.release(); await resume.promise; }
      return original(id, tx);
    });
    const grant = seats.grant(pending.id, pendingLink.id, coach.id);
    try {
      await paused.promise;
      // Invoke W8 directly: link fencing must work even without the identity erasure fence.
      await app.get(MentorshipErasureService).eraseUserData(coach.id);
      resume.release();
      expect(await grant).toBe(false);
      const { remainingLinks, funded } = await withServiceContext(harness.db, async (tx) => ({
        remainingLinks: await tx.select().from(coachStudents).where(eq(coachStudents.coachId, coach.id)),
        funded: await tx.select().from(subscriptions).where(inArray(subscriptions.userId, [student.id, pending.id])),
      }));
      expect(remainingLinks).toEqual([]);
      expect(funded).toHaveLength(1);
      expect(funded[0]).toMatchObject({ provider: "SPONSOR", status: "EXPIRED", sponsorLinkId: null });
      expect(await subscriptionsRepo.findOpenForUser(student.id)).toBeUndefined();
      expect(await subscriptionsRepo.findOpenForUser(pending.id)).toBeUndefined();
      expect(await subscriptionsRepo.findOpenForUser(payer.id)).toMatchObject({ id: paid.id, status: "ACTIVE", provider: "FAKE" });
    } finally { resume.release(); await grant; spy.mockRestore(); }
  });

  it("email PATCH closes existing coach authority until the new address is verified", async () => {
    const { coach, student } = await fixture();
    await expect(links.requireActiveLink(coach.id, student.id)).resolves.toBeDefined();
    const patch = await request(app.getHttpServer()).patch("/v1/users/me")
      .set("Authorization", `Bearer ${coach.accessToken}`)
      .send({ email: `changed-${coach.id}@test.local` });
    expect(patch.status).toBe(200);
    await expect(links.requireActiveLink(coach.id, student.id)).rejects.toMatchObject({ code: "MENTORSHIP_EMAIL_NOT_VERIFIED" });
    expect(await app.get(UsersService).getVerifiedNotificationContact(coach.id)).toBeNull();
    await expect(links.requireStudentLink(student.id)).resolves.toBeDefined();
    await withServiceContext(harness.db, (tx) => tx.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, coach.id)));
    await expect(links.requireActiveLink(coach.id, student.id)).resolves.toBeDefined();
    expect(await app.get(UsersService).getVerifiedNotificationContact(coach.id)).toMatchObject({ email: `changed-${coach.id}@test.local` });
  });
});
