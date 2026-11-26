import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isFinalizeSettled,
  isOwnRecord,
  pickSessionResume,
  readActiveSessionRecord,
  resolveSessionResume,
  type ActiveSessionRecord,
  ambientTheme,
  angleFromMinutes,
  angleFromPoint,
  clampMinutes,
  distinctSubjects,
  groupSessionsByDay,
  historyDateRange,
  minutesFromAngle,
  readAmbientPreference,
  readSessionScene,
  sessionStarFill,
  shareSessionOrdinal,
  shareableMinutes,
  shouldPlayAmbient,
} from "./session-view.ts";

describe("timer dial", () => {
  it("reads angles clockwise from 12 o'clock", () => {
    assert.equal(angleFromPoint(0, -10), 0);
    assert.equal(angleFromPoint(10, 0), 90);
    assert.equal(angleFromPoint(0, 10), 180);
    assert.equal(angleFromPoint(-10, 0), 270);
  });

  it("maps angle and minutes both ways within 5–200", () => {
    assert.equal(minutesFromAngle(0, 5, 200, 1), 5);
    assert.equal(minutesFromAngle(180, 5, 200, 1), 103);
    assert.equal(minutesFromAngle(360, 5, 200, 1), 200);
    assert.equal(angleFromMinutes(5, 5, 200), 0);
    assert.equal(angleFromMinutes(200, 5, 200), 360);
  });

  it("clamps nudges to the bounds", () => {
    assert.equal(clampMinutes(4, 5, 200, 1), 5);
    assert.equal(clampMinutes(201, 5, 200, 1), 200);
    assert.equal(clampMinutes(26, 5, 200, 1), 26);
  });
});

describe("scene and room sound", () => {
  it("falls back to the library room on bad input", () => {
    assert.deepEqual(readSessionScene(null), { theme: "LIBRARY", plain: false });
    assert.deepEqual(readSessionScene('{"theme":"CAFE","plain":true}'), { theme: "CAFE", plain: true });
    assert.deepEqual(readSessionScene('{"theme":"MOON"}'), { theme: "LIBRARY", plain: false });
  });

  it("starts silent and never stores mute for silence", () => {
    assert.deepEqual(readAmbientPreference(null), { trackId: "off", muted: false });
    assert.deepEqual(readAmbientPreference('{"trackId":"cafe","muted":true}'), { trackId: "cafe", muted: true });
    assert.deepEqual(readAmbientPreference('{"trackId":"off","muted":true}'), { trackId: "off", muted: false });
  });

  it("plays the scene's room unless a room is pinned", () => {
    assert.equal(ambientTheme("scene", "HOME"), "HOME");
    assert.equal(ambientTheme("library", "CAFE"), "LIBRARY");
    assert.equal(ambientTheme("off", "CAFE"), null);
  });

  it("plays only while the timer runs", () => {
    const on = { trackId: "scene", muted: false } as const;
    assert.equal(shouldPlayAmbient("focus", false, on), true);
    assert.equal(shouldPlayAmbient("break", false, on), true);
    assert.equal(shouldPlayAmbient("focus", true, on), false);
    assert.equal(shouldPlayAmbient("idle", false, on), false);
    assert.equal(shouldPlayAmbient("focus", false, { ...on, muted: true }), false);
  });
});

describe("done state", () => {
  it("fills stars in halves, at least one", () => {
    assert.equal(sessionStarFill({ elapsedSec: 1500, plannedSec: 1500, countsAsFocusSession: true }), 3);
    assert.equal(sessionStarFill({ elapsedSec: 750, plannedSec: 1500, countsAsFocusSession: true }), 1.5);
    assert.equal(sessionStarFill({ elapsedSec: 10, plannedSec: 1500, countsAsFocusSession: true }), 1);
    assert.equal(sessionStarFill({ elapsedSec: 30, plannedSec: 1500, countsAsFocusSession: false }), 1);
  });

  it("shares whole minutes of counted sessions only", () => {
    assert.equal(shareableMinutes(90, true), 1);
    assert.equal(shareableMinutes(59, true), null);
    assert.equal(shareableMinutes(600, false), null);
  });

  it("numbers the session among today's counted ones", () => {
    const today = [
      { id: "b", status: "COMPLETED", startedAt: "2026-11-26T10:00:00Z", countsAsFocusSession: true },
      { id: "x", status: "ABANDONED", startedAt: "2026-11-26T09:30:00Z", countsAsFocusSession: false },
      { id: "a", status: "COMPLETED", startedAt: "2026-11-26T09:00:00Z", countsAsFocusSession: true },
    ] as const;
    assert.equal(shareSessionOrdinal([...today], "b"), 2);
    assert.equal(shareSessionOrdinal([...today], "a"), 1);
    assert.equal(shareSessionOrdinal([...today], "new"), 3);
  });
});

describe("history", () => {
  it("builds inclusive date windows", () => {
    const now = new Date("2026-11-26T12:00:00Z");
    assert.deepEqual(historyDateRange("all", now), {});
    assert.deepEqual(historyDateRange("today", now), { from: "2026-11-26", to: "2026-11-26" });
    assert.deepEqual(historyDateRange("7d", now), { from: "2026-11-20", to: "2026-11-26" });
    assert.deepEqual(historyDateRange("30d", now), { from: "2026-10-28", to: "2026-11-26" });
  });

  it("lists subjects once, in order", () => {
    assert.deepEqual(distinctSubjects([{ subject: "Fizik" }, { subject: " Fizik " }, { subject: null }, { subject: "Tarih" }]), ["Fizik", "Tarih"]);
  });

  it("groups consecutive sessions by day", () => {
    const groups = groupSessionsByDay([
      { startedAt: "2026-11-26T15:00:00" },
      { startedAt: "2026-11-26T09:00:00" },
      { startedAt: "2026-11-25T20:00:00" },
    ]);
    assert.deepEqual(groups.map((g) => g.items.length), [2, 1]);
  });
});

describe("kept running session", () => {
  const base: ActiveSessionRecord = {
    sessionId: "s1", phase: "focus", phaseEndsAt: 1_000_000 + 25 * 60_000, isPaused: false, pausedAt: null,
    focusMinutes: 25, breakMinutes: 5, preset: "25_5", subject: "Mat", planTaskId: null, planTaskTitle: null,
    roomId: null, session: { id: "s1" } as ActiveSessionRecord["session"], focusElapsed: 0, savedAt: 1_000_000,
  };
  const MAX = 4 * 3600_000;

  it("reads only whole records whose session matches", () => {
    assert.deepEqual(readActiveSessionRecord(JSON.stringify(base)), base);
    assert.equal(readActiveSessionRecord(JSON.stringify({ ...base, session: { id: "x" } })), null);
    assert.equal(readActiveSessionRecord("{bad"), null);
    assert.equal(readActiveSessionRecord(null), null);
  });

  it("resumes focus, paused focus, stopwatch and break", () => {
    assert.deepEqual(resolveSessionResume(base, 1_000_000 + 60_000, MAX), { kind: "resume-focus", secondsLeft: 24 * 60 });
    const paused = { ...base, isPaused: true, pausedAt: 1_000_000 + 60_000 };
    assert.deepEqual(resolveSessionResume(paused, 1_000_000 + 30 * 60_000, MAX), { kind: "resume-focus", secondsLeft: 24 * 60 });
    const watch = { ...base, preset: "stopwatch" as const, focusElapsed: 100 };
    assert.deepEqual(resolveSessionResume(watch, 1_000_000 + 50_000, MAX), { kind: "resume-stopwatch", elapsedSeconds: 150 });
    const brk = { ...base, phase: "break" as const, phaseEndsAt: 1_000_000 + 60_000 };
    assert.deepEqual(resolveSessionResume(brk, 1_000_000 + 30_000, MAX), { kind: "resume-break", secondsLeft: 30 });
    assert.deepEqual(resolveSessionResume(brk, 1_000_000 + 90_000, MAX), { kind: "done" });
  });

  it("restores only the signed-in account's own record (sign-out or deletion that failed to delete it)", () => {
    const own = { ...base, userId: "u1" };
    assert.equal(isOwnRecord(own, "u1"), true);
    assert.equal(isOwnRecord(own, "u2"), false);
    assert.equal(isOwnRecord(own, null), false);
    assert.equal(isOwnRecord(base, "u1"), false);
    // The owner survives a write and read round trip.
    assert.equal(isOwnRecord(readActiveSessionRecord(JSON.stringify(own))!, "u1"), true);
  });

  it("never restores a record a failed sign-out or deletion left behind for the next account", () => {
    const leftover = JSON.stringify({ ...base, userId: "u1" });
    const now = 1_000_000 + 60_000;
    assert.equal(pickSessionResume(leftover, "u2", now, MAX), "clear");
    // A cold start before sign-in settles keeps the record instead of deleting it.
    assert.equal(pickSessionResume(leftover, null, now, MAX), null);
    assert.equal(pickSessionResume(JSON.stringify(base), "u2", now, MAX), "clear");
    assert.deepEqual(pickSessionResume(leftover, "u1", now, MAX), {
      record: { ...base, userId: "u1" },
      resolution: { kind: "resume-focus", secondsLeft: 24 * 60 },
    });
    assert.equal(pickSessionResume(null, "u1", now, MAX), null);
  });

  it("treats a close-out the server already took as done, other errors as retryable", () => {
    assert.equal(isFinalizeSettled("COACHING_SESSION_ALREADY_CLOSED"), true);
    assert.equal(isFinalizeSettled("NETWORK_ERROR"), false);
    assert.equal(isFinalizeSettled(undefined), false);
  });

  it("credits an expired focus up to its end, and drops old records", () => {
    assert.deepEqual(resolveSessionResume(base, 1_000_000 + 40 * 60_000, MAX), { kind: "finalize-expired", creditSeconds: 25 * 60 });
    assert.deepEqual(resolveSessionResume(base, 1_000_000 + MAX + 1, MAX), { kind: "discard" });
  });
});
