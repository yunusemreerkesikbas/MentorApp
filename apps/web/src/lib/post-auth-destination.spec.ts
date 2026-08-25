import { describe, expect, it } from "vitest";
import type { AuthUser } from "@mentor/types";
import { hasCompletedOnboarding, postAuthDestination } from "./post-auth-destination";

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    email: "a@b.co",
    displayName: "Ada",
    username: null,
    avatarUrl: null,
    bio: null,
    website: null,
    roles: ["STUDENT"],
    organizationId: null,
    examType: null,
    examVariant: null,
    examDate: null,
    dailyFocusGoalMinutes: null,
    emailVerified: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("postAuthDestination", () => {
  it("sends signup without username to onboarding", () => {
    expect(postAuthDestination(user())).toBe("/onboarding");
    expect(hasCompletedOnboarding(user())).toBe(false);
  });

  it("still onboards when username exists but exam is missing", () => {
    expect(postAuthDestination(user({ username: "ada" }))).toBe("/onboarding");
  });

  it("opens the dashboard only after username and examType", () => {
    expect(
      postAuthDestination(user({ username: "ada", examType: "KPSS" })),
    ).toBe("/dashboard");
  });
});
