import { describe, expect, it } from "vitest";

import {
  onboardingDestination,
  onboardingProgressStep,
  onboardingTotalSteps,
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

  describe("the coach branch (APP-089)", () => {
    it("shares the first four steps with a student", () => {
      expect(nextOnboardingStep("intro", null, "coach")).toBe("username");
      expect(nextOnboardingStep("username", null, "coach")).toBe("avatar");
      expect(nextOnboardingStep("avatar", null, "coach")).toBe("exam");
    });

    it("swaps the personal goal for the coach profile", () => {
      // The goal step writes a vision board — "Bu yolun sonunda ne var?" is a student's question,
      // and making a coach answer it was the mismatch this branch exists to remove.
      expect(nextOnboardingStep("exam", "YKS", "coach")).toBe("coachProfile");
      expect(nextOnboardingStep("kpssLevel", "KPSS", "coach")).toBe("coachProfile");
      expect(nextOnboardingStep("coachProfile", null, "coach")).toBe("complete");
    });

    it("keeps the exam question, because the app gate depends on it", () => {
      // `hasCompletedOnboarding` is `username && examType` and guards all of `(app)`. A coach who
      // skipped this could never reach their own profile screen.
      expect(nextOnboardingStep("avatar", null, "coach")).toBe("exam");
      expect(nextOnboardingStep("exam", "KPSS", "coach")).toBe("kpssLevel");
    });

    it("walks back the way it came, KPSS or not", () => {
      expect(previousOnboardingStep("coachProfile", "KPSS", "coach")).toBe("kpssLevel");
      expect(previousOnboardingStep("coachProfile", "YKS", "coach")).toBe("exam");
      expect(previousOnboardingStep("complete", null, "coach")).toBe("coachProfile");
    });

    it("counts the same number of dots, with the last one meaning something else", () => {
      expect(onboardingTotalSteps("coach")).toBe(onboardingTotalSteps("student"));
      expect(onboardingProgressStep("coachProfile", "coach")).toBe(4);
      // The student's last step is not on the coach's bar at all, and vice versa.
      expect(onboardingProgressStep("goal", "coach")).toBeNull();
      expect(onboardingProgressStep("coachProfile", "student")).toBeNull();
    });

    it("lands a coach on their own panel, invite or not", () => {
      // A coach who just wrote a coach profile does not want a study plan.
      expect(onboardingDestination(null, "coach")).toBe("/students");
      expect(onboardingDestination("/join-room?kod=MASA-A1B2C3", "coach")).toBe("/students");
    });
  });
});
