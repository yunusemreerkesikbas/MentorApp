import { describe, expect, it, vi } from "vitest";
import { AppAvailabilityService } from "./app-availability.service";
import { CONFIG_CATALOG, type ConfigKey } from "./config.catalog";

function fixture(overrides: Record<string, boolean> = {}, provider = "fake") {
  const config = { get: vi.fn(async (key: ConfigKey) => overrides[key] ?? CONFIG_CATALOG[key].default) };
  const env = { get: vi.fn((key: string) => key === "PAYMENTS_PROVIDER" ? provider : "must-not-be-exposed") };
  return { service: new AppAvailabilityService(config as never, env as never), config, env };
}

describe("public app availability", () => {
  it("returns only explicit non-secret effective capabilities", async () => {
    const f = fixture();
    const result = await f.service.get();
    expect(Object.keys(result).sort()).toEqual([
      "aiCoach", "coachPurchases", "coachRegistration", "coachSignup", "economy", "forum", "humanCoaching", "invites", "social",
      "studentPurchases", "studentSignup", "studyRooms",
    ]);
    expect(Object.values(result).every(value => typeof value === "boolean")).toBe(true);
    expect(f.env.get).toHaveBeenCalledWith("PAYMENTS_PROVIDER", { infer: true });
    expect(f.env.get).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain("must-not-be-exposed");
  });

  it("represents the explicit core-only profile without hiding student registration", async () => {
    const f = fixture({
      "ai.enabled": false, "community.social.enabled": false, "forum.enabled": false,
      "coaching.study_rooms.enabled": false, "mentorship.enabled": false,
      "payments.web.enabled": false, "payments.mobile.enabled": false,
      "mentorship.seats.billing_enabled": false, "mentorship.seats.mobile_billing_enabled": false,
      "mentorship.applications.open": false, "economy.enabled": false, "signup.enabled": true,
    }, "disabled");
    expect(await f.service.get()).toEqual({
      aiCoach: false, social: false, forum: false, studyRooms: false, humanCoaching: false,
      studentPurchases: false, coachPurchases: false, studentSignup: true, coachRegistration: false, coachSignup: false,
      economy: false, invites: false,
    });
  });

  it("tells the landing whether quests, XP and Coin are on, apart from invitations", async () => {
    expect(await fixture({ "economy.enabled": true, "community.social.enabled": false }).service.get())
      .toMatchObject({ economy: true, invites: false });
    expect(await fixture({ "economy.enabled": false }).service.get()).toMatchObject({ economy: false });
  });

  it("does not advertise web purchases when the provider is disabled", async () => {
    const f = fixture({ "payments.web.enabled": true, "mentorship.seats.billing_enabled": true }, "disabled");
    expect(await f.service.get()).toMatchObject({ studentPurchases: false, coachPurchases: false });
  });

  it("preserves the existing store handoff rules independently for each audience", async () => {
    const f = fixture({ "payments.web.redirect_to_mobile": true, "payments.mobile.enabled": true, "mentorship.seats.mobile_billing_enabled": false }, "disabled");
    expect(await f.service.get()).toMatchObject({ studentPurchases: true, coachPurchases: false });
  });

  it("does not advertise invitation or coach signup paths while their required switch is closed", async () => {
    const f = fixture({ "economy.enabled": true, "community.social.enabled": false, "signup.enabled": false, "mentorship.applications.open": true });
    expect(await f.service.get()).toMatchObject({ invites: false, studentSignup: false, coachSignup: false });
  });

  it("keeps existing-account coach registration independent of new-account signup", async () => {
    const f = fixture({ "signup.enabled": false, "mentorship.applications.open": true });
    expect(await f.service.get()).toMatchObject({ studentSignup: false, coachSignup: false, coachRegistration: true });
  });

  it("propagates configuration failure instead of enabling features with defaults", async () => {
    const f = fixture();
    f.config.get.mockRejectedValue(new Error("configuration unavailable"));
    await expect(f.service.get()).rejects.toThrow("configuration unavailable");
  });
});
