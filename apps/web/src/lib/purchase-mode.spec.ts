import type { PlanDto } from "@mentor/types";
import { describe, expect, it } from "vitest";
import { plansForAudience, purchaseMode } from "./purchase-mode";

const STUDENT: PlanDto = {
  id: "premium-monthly",
  name: "Premium Aylık",
  periodMonths: 1,
  priceMinor: 24900,
  currency: "TRY",
  trialDays: 7,
  seatCount: 0,
  purchaseEnabled: true,
  redirectToMobile: false,
};
const COACH: PlanDto = { ...STUDENT, id: "coach-pro-10", name: "Koç Pro 10", seatCount: 10 };
const STORE_ONLY: PlanDto = { ...STUDENT, purchaseEnabled: false, redirectToMobile: true };

const APP_STORE = "https://apps.apple.com/tr/app/mentor/id1";
const PLAY_STORE = "https://play.google.com/store/apps/details?id=app.mentor";

describe("purchaseMode", () => {
  it("checks out on the web while a plan is web-purchasable", () => {
    expect(purchaseMode([STUDENT], { appStore: APP_STORE, playStore: PLAY_STORE })).toBe("checkout");
  });

  it("hands off to the stores when only a store can sell", () => {
    expect(purchaseMode([STORE_ONLY], { appStore: APP_STORE, playStore: PLAY_STORE })).toBe("store");
  });

  it("hands off with a single configured store", () => {
    expect(purchaseMode([STORE_ONLY], { appStore: null, playStore: PLAY_STORE })).toBe("store");
  });

  it("falls back to coming soon when no store link is configured", () => {
    expect(purchaseMode([STORE_ONLY], { appStore: null, playStore: null })).toBe("unavailable");
  });

  it("is unavailable when neither the web nor a store sells", () => {
    expect(
      purchaseMode([{ ...STUDENT, purchaseEnabled: false }], {
        appStore: APP_STORE,
        playStore: PLAY_STORE,
      }),
    ).toBe("unavailable");
  });

  it("is unavailable with an empty catalog", () => {
    expect(purchaseMode([], { appStore: APP_STORE, playStore: PLAY_STORE })).toBe("unavailable");
  });
});

describe("plansForAudience", () => {
  it("shows a coach only the seat plans", () => {
    expect(plansForAudience([STUDENT, COACH], true)).toEqual([COACH]);
  });

  it("shows a student only the student plans", () => {
    expect(plansForAudience([STUDENT, COACH], false)).toEqual([STUDENT]);
  });
});
