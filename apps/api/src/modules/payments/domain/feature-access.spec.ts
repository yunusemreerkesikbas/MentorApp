import { describe, expect, it } from "vitest";
import { evaluateFeatureAccess } from "./feature-access";

describe("evaluateFeatureAccess", () => {
  it("allows premium regardless of free flags or usage", () => {
    expect(
      evaluateFeatureAccess({
        isPremium: true,
        freeEnabled: false,
        used: 99,
        freeLimit: 1,
      }),
    ).toEqual({ allowed: true });
  });

  it("denies free users when the surface is not opened", () => {
    expect(
      evaluateFeatureAccess({
        isPremium: false,
        freeEnabled: false,
        used: 0,
        freeLimit: 3,
      }),
    ).toEqual({ allowed: false, reason: "PAYMENT_PREMIUM_REQUIRED" });
  });

  it("allows free users under the free cap", () => {
    expect(
      evaluateFeatureAccess({
        isPremium: false,
        freeEnabled: true,
        used: 0,
        freeLimit: 1,
      }),
    ).toEqual({ allowed: true });
  });

  it("denies free users who have used the free cap", () => {
    expect(
      evaluateFeatureAccess({
        isPremium: false,
        freeEnabled: true,
        used: 1,
        freeLimit: 1,
      }),
    ).toEqual({ allowed: false, reason: "PAYMENT_PREMIUM_REQUIRED" });
  });
});
