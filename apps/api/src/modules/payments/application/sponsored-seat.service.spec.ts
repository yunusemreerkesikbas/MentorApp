import { describe, expect, it, vi } from "vitest";
import { costPerSeatMicros, SponsoredSeatService } from "./sponsored-seat.service";

const STUDENT = "11111111-1111-4111-8111-111111111111";
const LINK = "22222222-2222-4222-8222-222222222222";
const TX = { execute: vi.fn() };
const COACH = "33333333-3333-4333-8333-333333333333";

function setup(
  over: { sponsorshipEnabled?: boolean; openForUser?: unknown; openBySponsorLink?: unknown; unverified?: string; eligible?: boolean; register?: boolean; emailVerified?: boolean } = {},
) {
  const config = {
    get: vi.fn(async () => over.sponsorshipEnabled ?? true),
  };
  const subscriptions = {
    findOpenForUser: vi.fn(async () => over.openForUser),
    findOpenBySponsorLink: vi.fn(async () => over.openBySponsorLink),
    expireAllSponsored: vi.fn(async () => 3),
    listSponsoredUserIds: vi.fn(async () => ["a", "b", "c"]),
    create: vi.fn(async (data: Record<string, unknown>) => ({ id: "sub-1", ...data })),
    expireSponsorship: vi.fn(async () => undefined),
  };
  const users = {
    isPhoneVerified: vi.fn(async (id: string) => id !== over.unverified),
    isEmailVerified: vi.fn(async () => over.emailVerified ?? true),
    lockActiveAccount: vi.fn(async () => true),
  };
  const db = { transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(TX)) };
  const service = new SponsoredSeatService(subscriptions as never, config as never, users as never, db as never);
  const eligible = vi.fn(async () => over.eligible ?? true);
  if (over.register !== false) service.registerEligibilityCheck(eligible);
  return {
    service, users, eligible, db,
    subscriptions,
    config,
  };
}

describe("SponsoredSeatService.grant", () => {
  it("fails closed before W8 registers its relationship check", async () => {
    const { service, subscriptions, db } = setup({ register: false });
    expect(await service.grant(STUDENT, LINK, COACH)).toBe(false);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(subscriptions.create).not.toHaveBeenCalled();
  });

  it("refuses an ended, unseated or mismatched relationship checked inside the insert transaction", async () => {
    const { service, subscriptions, eligible } = setup({ eligible: false });
    expect(await service.grant(STUDENT, LINK, COACH)).toBe(false);
    expect(eligible).toHaveBeenCalledWith(STUDENT, LINK, COACH, TX);
    expect(subscriptions.create).not.toHaveBeenCalled();
  });

  it("holds stable active identity locks before the relationship and open-subscription check", async () => {
    const { service, users, eligible, subscriptions } = setup();
    await service.grant(STUDENT, LINK, COACH);
    expect(users.lockActiveAccount.mock.calls).toEqual([[STUDENT, TX], [COACH, TX]]);
    expect(eligible.mock.invocationCallOrder[0]).toBeGreaterThan(users.lockActiveAccount.mock.invocationCallOrder[1]!);
    expect(subscriptions.findOpenForUser).toHaveBeenCalledWith(STUDENT, TX);
    expect(subscriptions.create.mock.invocationCallOrder[0]).toBeGreaterThan(eligible.mock.invocationCallOrder[0]!);
  });

  it("holds sponsorship when a verified coach changes email", async () => {
    const { service, subscriptions } = setup({ emailVerified: false });
    expect(await service.grant(STUDENT, LINK, COACH)).toBe(false);
    expect(subscriptions.create).not.toHaveBeenCalled();
  });
  it("writes an endless ACTIVE row so no extension cron is ever needed", async () => {
    const { service, subscriptions } = setup();
    expect(await service.grant(STUDENT, LINK, COACH)).toBe(true);
    expect(subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: STUDENT,
        planId: "coach-seat",
        provider: "SPONSOR",
        status: "ACTIVE",
        // The ACTIVE branch of computeEntitlement skips the expiry check when there is no end
        // date, so the seat lasts until revoke says otherwise.
        currentPeriodEnd: null,
        sponsorLinkId: LINK,
      }),
      TX,
    );
  });

  /**
   * The student's own purchase always wins. Not merely good manners: the partial unique index
   * allows one non-terminal subscription per user, so the insert would fail anyway — and losing
   * that race would mean a coach's free seat had displaced something somebody paid for.
   */
  it("leaves a student who already pays for themselves alone", async () => {
    const { service, subscriptions } = setup({ openForUser: { id: "own", status: "ACTIVE" } });
    expect(await service.grant(STUDENT, LINK, COACH)).toBe(false);
    expect(subscriptions.create).not.toHaveBeenCalled();
  });

  it("writes nothing while sponsorship is switched off", async () => {
    const { service, subscriptions } = setup({ sponsorshipEnabled: false });
    expect(await service.grant(STUDENT, LINK, COACH)).toBe(false);
    expect(subscriptions.findOpenForUser).not.toHaveBeenCalled();
    expect(subscriptions.create).not.toHaveBeenCalled();
  });

  it.each([STUDENT, COACH])("does not grant when %s has no ACTIVE verified phone", async (id) => {
    const { service, subscriptions } = setup({ unverified: id });
    expect(await service.grant(STUDENT, LINK, COACH)).toBe(false);
    expect(subscriptions.create).not.toHaveBeenCalled();
  });
});

describe("SponsoredSeatService.revoke", () => {
  it("expires the row rather than deleting it", async () => {
    const now = new Date("2026-09-05T10:00:00Z");
    const { service, subscriptions } = setup({ openBySponsorLink: { id: "sub-1" } });
    expect(await service.revoke(LINK, now)).toBe(true);
    expect(subscriptions.expireSponsorship).toHaveBeenCalledWith("sub-1", now);
  });

  it("is a no-op when the link never held a seat", async () => {
    const { service, subscriptions } = setup({ openBySponsorLink: undefined });
    expect(await service.revoke(LINK)).toBe(false);
    expect(subscriptions.expireSponsorship).not.toHaveBeenCalled();
  });
});

describe("costPerSeatMicros", () => {
  it("divides the cohort cost across live seats", () => {
    expect(costPerSeatMicros(900, 3)).toBe(300);
  });

  /**
   * The load-bearing one. Zero would read as "seats are free" — the opposite of what an empty
   * cohort means — and this is the number an operator uses to decide whether
   * `mentorship.coach.free_seats` is set too high.
   */
  it("reports no figure at all when nobody holds a seat", () => {
    expect(costPerSeatMicros(0, 0)).toBeNull();
    expect(costPerSeatMicros(500, 0)).toBeNull();
  });
});

describe("SponsoredSeatService.revokeAll — the kill switch", () => {
  it("expires every live seat and reports how many, without deleting anything", async () => {
    const now = new Date("2026-09-05T12:00:00Z");
    const { service, subscriptions } = setup();
    expect(await service.revokeAll(now)).toBe(3);
    expect(subscriptions.expireAllSponsored).toHaveBeenCalledWith(now);
  });
});
