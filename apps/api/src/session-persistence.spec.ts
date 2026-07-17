import { describe, expect, it } from "vitest";
import {
  type ActiveSessionRecord,
  resolveResume,
} from "../../web/src/lib/session-persistence";

const NOW = 1_700_000_000_000;

function record(overrides: Partial<ActiveSessionRecord> = {}): ActiveSessionRecord {
  return {
    sessionId: "5523a9e3-8a12-4547-a998-181548f2a15a",
    phase: "focus",
    phaseEndsAt: NOW + 10 * 60_000,
    isPaused: false,
    pausedAt: null,
    focusMinutes: 25,
    breakMinutes: 5,
    preset: "25_5",
    subject: null,
    planTaskId: null,
    planTaskTitle: null,
    focusElapsed: 15 * 60,
    savedAt: NOW - 1000,
    ...overrides,
  };
}

describe("resolveResume", () => {
  it("resumes a running focus with the wall-clock remaining", () => {
    expect(resolveResume(record(), NOW)).toEqual({
      kind: "resume-focus",
      secondsLeft: 600,
    });
  });

  it("resumes a paused focus frozen at the pause instant, regardless of time away", () => {
    const pausedAt = NOW - 3 * 60 * 60_000; // paused 3h ago
    const result = resolveResume(
      record({
        isPaused: true,
        pausedAt,
        phaseEndsAt: pausedAt + 7 * 60_000,
        savedAt: NOW - 3 * 60 * 60_000,
      }),
      NOW,
    );
    expect(result).toEqual({ kind: "resume-focus", secondsLeft: 420 });
  });

  it("finalizes an expired focus, crediting elapsed advanced only up to the focus end", () => {
    // Saved with 20min elapsed, 5min remaining; user returns 2h later.
    const result = resolveResume(
      record({
        phaseEndsAt: NOW - 2 * 60 * 60_000 + 5 * 60_000,
        savedAt: NOW - 2 * 60 * 60_000,
        focusElapsed: 20 * 60,
      }),
      NOW,
    );
    expect(result).toEqual({ kind: "finalize-expired", creditSeconds: 25 * 60 });
  });

  it("caps expired-focus credit at the planned length", () => {
    const result = resolveResume(
      record({
        phaseEndsAt: NOW - 60_000,
        savedAt: NOW - 10 * 60_000,
        focusElapsed: 24 * 60 + 50, // near-full already observed
      }),
      NOW,
    );
    expect(result.kind).toBe("finalize-expired");
    expect((result as { creditSeconds: number }).creditSeconds).toBe(25 * 60);
  });

  it("credits only the observed elapsed when the focus expired while paused", () => {
    const result = resolveResume(
      record({
        isPaused: true,
        pausedAt: NOW - 60_000,
        phaseEndsAt: NOW - 60_000, // remaining hit 0 at the pause instant
        focusElapsed: 12 * 60,
        savedAt: NOW - 60_000,
      }),
      NOW,
    );
    expect(result).toEqual({ kind: "finalize-expired", creditSeconds: 12 * 60 });
  });

  it("resumes a running break", () => {
    const result = resolveResume(
      record({ phase: "break", phaseEndsAt: NOW + 90_000 }),
      NOW,
    );
    expect(result).toEqual({ kind: "resume-break", secondsLeft: 90 });
  });

  it("reports done for an expired break (session already finalized at focus end)", () => {
    const result = resolveResume(
      record({ phase: "break", phaseEndsAt: NOW - 1000 }),
      NOW,
    );
    expect(result).toEqual({ kind: "done" });
  });

  it("discards ancient records", () => {
    const result = resolveResume(
      record({ savedAt: NOW - 25 * 60 * 60_000 }),
      NOW,
    );
    expect(result).toEqual({ kind: "discard" });
  });
});
