import { describe, expect, it } from "vitest";
import type { ExamType } from "@mentor/types";

import {
  onboardingDestination,
  onboardingProgress,
  nextOnboardingStep,
  previousOnboardingStep,
  type OnboardingAudience,
  type OnboardingStep,
} from "./onboarding-flow";

function walkForward(examType: ExamType | null, audience: OnboardingAudience = "student") {
  const walked: OnboardingStep[] = [];
  let step: OnboardingStep = "intro";
  while (step !== "complete") {
    step = nextOnboardingStep(step, examType, audience);
    walked.push(step);
  }
  return walked;
}

describe("onboarding flow", () => {
  it("asks the questions in the agreed order, username last", () => {
    expect(walkForward("KPSS")).toEqual(["exam", "kpssLevel", "why", "field", "dailyGoal", "profile", "complete"]);
  });

  it("skips the KPSS-only question for YKS and LGS, both ways", () => {
    expect(nextOnboardingStep("exam", "YKS")).toBe("why");
    expect(nextOnboardingStep("exam", "LGS")).toBe("why");
    expect(previousOnboardingStep("why", "YKS")).toBe("exam");
    expect(previousOnboardingStep("why", "KPSS")).toBe("kpssLevel");
  });

  it("stays put at both ends", () => {
    expect(previousOnboardingStep("intro", null)).toBe("intro");
    expect(nextOnboardingStep("complete", "KPSS")).toBe("complete");
  });

  it("fills seven segments and leaves the last one to completion", () => {
    expect(onboardingProgress("intro")).toBeNull();
    expect(onboardingProgress("exam")).toEqual({ done: 1, total: 7 });
    expect(onboardingProgress("why")).toEqual({ done: 3, total: 7 });
    expect(onboardingProgress("profile")).toEqual({ done: 6, total: 7 });
    expect(onboardingProgress("complete")).toBeNull();
  });

  it("preserves a pending invite and otherwise opens the dashboard", () => {
    expect(onboardingDestination("/join-room?kod=MASA-A1B2C3")).toBe("/join-room?kod=MASA-A1B2C3");
    expect(onboardingDestination(null)).toBe("/dashboard");
  });

  describe("the coach branch (APP-089)", () => {
    it("asks the exam, then the coach profile, then the username", () => {
      expect(walkForward("YKS", "coach")).toEqual(["exam", "coachProfile", "profile", "complete"]);
      expect(walkForward("KPSS", "coach")).toEqual(["exam", "kpssLevel", "coachProfile", "profile", "complete"]);
    });

    it("never asks a coach why, which field or how long a day", () => {
      // Those answers write a student's goal board and study rhythm.
      for (const step of ["why", "field", "dailyGoal"] as const) {
        expect(onboardingProgress(step, "coach")).toBeNull();
      }
      expect(onboardingProgress("coachProfile", "student")).toBeNull();
    });

    it("walks back the way it came, KPSS or not", () => {
      expect(previousOnboardingStep("coachProfile", "KPSS", "coach")).toBe("kpssLevel");
      expect(previousOnboardingStep("coachProfile", "YKS", "coach")).toBe("exam");
      expect(previousOnboardingStep("profile", "YKS", "coach")).toBe("coachProfile");
    });

    it("counts its own, shorter bar", () => {
      expect(onboardingProgress("exam", "coach")).toEqual({ done: 1, total: 5 });
      expect(onboardingProgress("profile", "coach")).toEqual({ done: 4, total: 5 });
    });

    it("lands a coach on their own panel, invite or not", () => {
      expect(onboardingDestination(null, "coach")).toBe("/students");
      expect(onboardingDestination("/join-room?kod=MASA-A1B2C3", "coach")).toBe("/students");
    });
  });
});
