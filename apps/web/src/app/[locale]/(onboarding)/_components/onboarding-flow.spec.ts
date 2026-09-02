import { describe, expect, it } from "vitest";

import {
  onboardingDestination,
  onboardingProgressStep,
  nextOnboardingStep,
  previousOnboardingStep,
} from "./onboarding-flow";

describe("onboarding flow", () => {
  it("adds a separate KPSS level question", () => {
    expect(nextOnboardingStep("exam", "KPSS")).toBe("kpssLevel");
    expect(nextOnboardingStep("kpssLevel", "KPSS")).toBe("goal");
    expect(previousOnboardingStep("goal", "KPSS")).toBe("kpssLevel");
  });

  it("skips the KPSS-only question for YKS and LGS", () => {
    expect(nextOnboardingStep("exam", "YKS")).toBe("goal");
    expect(nextOnboardingStep("exam", "LGS")).toBe("goal");
    expect(previousOnboardingStep("goal", "YKS")).toBe("exam");
  });

  it("uses five fixed progress positions", () => {
    expect(onboardingProgressStep("intro")).toBeNull();
    expect(onboardingProgressStep("username")).toBe(0);
    expect(onboardingProgressStep("avatar")).toBe(1);
    expect(onboardingProgressStep("exam")).toBe(2);
    expect(onboardingProgressStep("kpssLevel")).toBe(3);
    expect(onboardingProgressStep("goal")).toBe(4);
    expect(onboardingProgressStep("complete")).toBeNull();
  });

  it("preserves a pending invite and otherwise opens the dashboard", () => {
    expect(onboardingDestination("/join-room?kod=MASA-A1B2C3")).toBe(
      "/join-room?kod=MASA-A1B2C3",
    );
    expect(onboardingDestination(null)).toBe("/dashboard");
  });
});
