import { describe, expect, it } from "vitest";
import { resolvePurchaseChannel, type PurchaseChannelFlags } from "./purchase-channel";

const STUDENT_PLAN = { seatCount: 0 };
const COACH_PLAN = { seatCount: 10 };

/** Production today: provider live, student web checkout on, every other channel off. */
const TODAY: PurchaseChannelFlags = {
  providerEnabled: true,
  studentWeb: true,
  studentMobile: false,
  coachWeb: false,
  coachMobile: false,
  redirectToMobile: false,
};

describe("resolvePurchaseChannel", () => {
  it("sells a student plan on the web with today's defaults", () => {
    expect(resolvePurchaseChannel(STUDENT_PLAN, TODAY)).toEqual({
      listed: true,
      purchaseEnabled: true,
      redirectToMobile: false,
    });
  });

  it("closes web checkout while the payment provider is disabled", () => {
    expect(resolvePurchaseChannel(STUDENT_PLAN, { ...TODAY, providerEnabled: false })).toEqual({
      listed: true,
      purchaseEnabled: false,
      redirectToMobile: false,
    });
  });

  it("sends students to the stores once web checkout is off and their store channel is on", () => {
    expect(
      resolvePurchaseChannel(STUDENT_PLAN, {
        ...TODAY,
        studentWeb: false,
        studentMobile: true,
        redirectToMobile: true,
      }),
    ).toEqual({ listed: true, purchaseEnabled: false, redirectToMobile: true });
  });

  it("never redirects an audience to a store that does not sell to it", () => {
    expect(
      resolvePurchaseChannel(STUDENT_PLAN, { ...TODAY, studentWeb: false, redirectToMobile: true }),
    ).toEqual({ listed: true, purchaseEnabled: false, redirectToMobile: false });
  });

  it("keeps 'coming soon' while the redirect flag is off", () => {
    expect(
      resolvePurchaseChannel(STUDENT_PLAN, { ...TODAY, studentWeb: false, studentMobile: true }),
    ).toEqual({ listed: true, purchaseEnabled: false, redirectToMobile: false });
  });

  it("does not redirect while web checkout is open", () => {
    expect(
      resolvePurchaseChannel(STUDENT_PLAN, { ...TODAY, studentMobile: true, redirectToMobile: true }),
    ).toEqual({ listed: true, purchaseEnabled: true, redirectToMobile: false });
  });

  it("keeps coach plans out of the catalog while both coach channels are off", () => {
    // Student channels wide open: none of them may leak onto a coach plan.
    expect(
      resolvePurchaseChannel(COACH_PLAN, { ...TODAY, studentMobile: true, redirectToMobile: true }),
    ).toEqual({ listed: false, purchaseEnabled: false, redirectToMobile: false });
  });

  it("sells coach plans on the web while student web checkout is off", () => {
    expect(
      resolvePurchaseChannel(COACH_PLAN, { ...TODAY, studentWeb: false, coachWeb: true }),
    ).toEqual({ listed: true, purchaseEnabled: true, redirectToMobile: false });
  });

  it("lists a coach plan for the store hand-off when only the coach store channel is on", () => {
    expect(
      resolvePurchaseChannel(COACH_PLAN, { ...TODAY, coachMobile: true, redirectToMobile: true }),
    ).toEqual({ listed: true, purchaseEnabled: false, redirectToMobile: true });
  });
});
