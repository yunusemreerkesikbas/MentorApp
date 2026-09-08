import { describe, expect, it } from "vitest";
import type { AuthUser } from "@mentor/types";
import {
  hasCompletedOnboarding,
  postAuthDestination,
  readAuthNextParam,
  safeNextPath,
} from "./post-auth-destination";

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

describe("safeNextPath", () => {
  it("accepts same-origin absolute paths", () => {
    expect(safeNextPath("/join-room?kod=MASA-A1B2C3")).toBe("/join-room?kod=MASA-A1B2C3");
    expect(safeNextPath("  /study-session  ")).toBe("/study-session");
  });

  it("rejects anything that could leave the site", () => {
    for (const hostile of [
      "https://evil.example/steal",
      "//evil.example/steal",
      "javascript:alert(1)",
      "evil.example",
      // A backslash the browser may normalise into "//" — built without an escape so no
      // toolchain layer can quietly collapse it on the way into this file.
      "/" + String.fromCharCode(92) + "evil.example",
      "",
      null,
      undefined,
    ]) {
      expect(safeNextPath(hostile)).toBeNull();
    }
  });

  it("rejects paths carrying control characters", () => {
    expect(safeNextPath("/ok" + String.fromCharCode(10) + "Location: /evil")).toBeNull();
    expect(safeNextPath("/ok" + String.fromCharCode(0))).toBeNull();
  });
});

describe("postAuthDestination with an invite", () => {
  const onboarded = { username: "ada", examType: "KPSS" } as const;

  it("follows a safe next once onboarding is complete", () => {
    expect(postAuthDestination(user(onboarded), "/join-room?kod=MASA-A1B2C3")).toBe(
      "/join-room?kod=MASA-A1B2C3",
    );
  });

  it("ignores a hostile next and falls back to the dashboard", () => {
    expect(postAuthDestination(user(onboarded), "https://evil.example")).toBe("/dashboard");
    expect(postAuthDestination(user(onboarded), null)).toBe("/dashboard");
  });

  it("still sends an unfinished profile to onboarding, invite or not", () => {
    // The invite is not lost — it is parked in session storage and resumed after onboarding.
    expect(postAuthDestination(user(), "/join-room?kod=MASA-A1B2C3")).toBe("/onboarding");
  });
});

describe("postAuthDestination for a coach (APP-090)", () => {
  // No `as const`: it would make `roles` readonly, which `Partial<AuthUser>` does not accept.
  const coach: Partial<AuthUser> = {
    username: "mert",
    examType: "KPSS",
    roles: ["STUDENT", "COACH"],
  };

  it("opens the coach's own surface, not the student dashboard", () => {
    expect(postAuthDestination(user(coach))).toBe("/students");
  });

  it("ignores a next that would land them on a blocked student screen", () => {
    // Every `next` this app produces is a student deep link, and all of them sit behind
    // `isStudentOnlyPath`. Honouring one would route a coach into a screen the `(app)` guard
    // bounces them out of a frame later — a redirect flash instead of a destination.
    expect(postAuthDestination(user(coach), "/join-room?kod=MASA-A1B2C3")).toBe("/students");
  });

  it("still onboards a coach whose profile is unfinished", () => {
    // The role does not skip the gate: `(app)` and `(coach)` both need a username.
    expect(postAuthDestination(user({ roles: ["STUDENT", "COACH"] }))).toBe("/onboarding");
  });
});

describe("readAuthNextParam", () => {
  it("returns null when window is unavailable", () => {
    expect(readAuthNextParam()).toBeNull();
  });
});
