import { describe, expect, it, vi } from "vitest";
import { SponsoredSeatService } from "./sponsored-seat.service";

const STUDENT = "11111111-1111-4111-8111-111111111111";
const LINK = "22222222-2222-4222-8222-222222222222";

function setup(
  over: { sponsorshipEnabled?: boolean; openForUser?: unknown; openBySponsorLink?: unknown } = {},
) {
  const config = {
    get: vi.fn(async () => over.sponsorshipEnabled ?? true),
  };
  const subscriptions = {
    findOpenForUser: vi.fn(async () => over.openForUser),
    findOpenBySponsorLink: vi.fn(async () => over.openBySponsorLink),
    create: vi.fn(async (data: Record<string, unknown>) => ({ id: "sub-1", ...data })),
    expireSponsorship: vi.fn(async () => undefined),
  };
  return {
    service: new SponsoredSeatService(subscriptions as never, config as never),
    subscriptions,
    config,
  };
}

describe("SponsoredSeatService.grant", () => {
  it("writes an endless ACTIVE row so no extension cron is ever needed", async () => {
    const { service, subscriptions } = setup();
    expect(await service.grant(STUDENT, LINK)).toBe(true);
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
    );
  });

  /**
   * The student's own purchase always wins. Not merely good manners: the partial unique index
   * allows one non-terminal subscription per user, so the insert would fail anyway — and losing
   * that race would mean a coach's free seat had displaced something somebody paid for.
   */
  it("leaves a student who already pays for themselves alone", async () => {
    const { service, subscriptions } = setup({ openForUser: { id: "own", status: "ACTIVE" } });
    expect(await service.grant(STUDENT, LINK)).toBe(false);
    expect(subscriptions.create).not.toHaveBeenCalled();
  });

  it("writes nothing while sponsorship is switched off", async () => {
    const { service, subscriptions } = setup({ sponsorshipEnabled: false });
    expect(await service.grant(STUDENT, LINK)).toBe(false);
    expect(subscriptions.findOpenForUser).not.toHaveBeenCalled();
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
