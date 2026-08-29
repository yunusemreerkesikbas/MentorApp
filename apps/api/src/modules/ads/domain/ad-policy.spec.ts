import { describe, expect, it } from "vitest";
import { ExamType } from "@mentor/types";
import { evaluateAdPolicy } from "./ad-policy";

const enabledRewarded = {
  globalEnabled: true,
  formatEnabled: true,
  placementEnabled: true,
  format: "REWARDED" as const,
  countryCode: "TR",
  examType: ExamType.KPSS,
  isPremium: false,
  userId: "user-1",
  rolloutPercent: 100,
};

describe("evaluateAdPolicy", () => {
  it("keeps every placement unavailable behind the global kill-switch", () => {
    expect(evaluateAdPolicy({ ...enabledRewarded, globalEnabled: false })).toEqual({
      enabled: false,
      reason: "GLOBAL_DISABLED",
      audienceTreatment: "NONE",
    });
  });

  it("keeps premium accounts entirely ad-free", () => {
    expect(evaluateAdPolicy({ ...enabledRewarded, isPremium: true })).toEqual({
      enabled: false,
      reason: "PREMIUM_AD_FREE",
      audienceTreatment: "NONE",
    });
  });

  it("does not serve without a CMP in an EEA country", () => {
    expect(evaluateAdPolicy({ ...enabledRewarded, countryCode: "DE" })).toEqual({
      enabled: false,
      reason: "REGION_REQUIRES_CONSENT",
      audienceTreatment: "NONE",
    });
  });

  it("maps LGS context to child treatment without collecting an age", () => {
    expect(evaluateAdPolicy({ ...enabledRewarded, examType: ExamType.LGS })).toEqual({
      enabled: true,
      reason: null,
      audienceTreatment: "CHILD",
    });
  });

  it("maps YKS context to teen treatment", () => {
    expect(evaluateAdPolicy({ ...enabledRewarded, examType: ExamType.YKS })).toEqual({
      enabled: true,
      reason: null,
      audienceTreatment: "TEEN",
    });
  });

  it("keeps a rewarded placement out of a zero-percent rollout", () => {
    expect(evaluateAdPolicy({ ...enabledRewarded, rolloutPercent: 0 })).toEqual({
      enabled: false,
      reason: "ROLLOUT_EXCLUDED",
      audienceTreatment: "NONE",
    });
  });

  it("does not require a user rollout for contextual display", () => {
    expect(
      evaluateAdPolicy({
        ...enabledRewarded,
        format: "DISPLAY",
        userId: null,
        rolloutPercent: 0,
      }),
    ).toEqual({ enabled: true, reason: null, audienceTreatment: "NONE" });
  });
});
