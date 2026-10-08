import { describe, expect, it } from "vitest";
import { resolveSessionShare, shareSessionOrdinal } from "./session-share";

describe("resolveSessionShare", () => {
  it("shares a counted session in whole minutes", () => {
    expect(resolveSessionShare(50 * 60 + 59, true)).toEqual({ minutes: 50 });
  });

  it("hides the card for a session that did not count, however long", () => {
    expect(resolveSessionShare(89, false)).toBeNull();
    expect(resolveSessionShare(30 * 60, false)).toBeNull();
  });

  it("hides the card under a minute", () => {
    expect(resolveSessionShare(59, true)).toBeNull();
  });
});

describe("shareSessionOrdinal", () => {
  const done = (id: string, hour: number, counts = true) => ({
    id,
    status: "COMPLETED",
    startedAt: `2026-10-07T${String(hour).padStart(2, "0")}:00:00.000Z`,
    countsAsFocusSession: counts,
  });

  it("counts only finished, counted sessions up to this one", () => {
    const today = [done("c", 15), done("short", 12, false), done("a", 9), done("b", 11)];
    expect(shareSessionOrdinal(today, "b")).toBe(2);
    expect(shareSessionOrdinal(today, "c")).toBe(3);
  });

  it("adds the finished session when the list has not caught up", () => {
    expect(shareSessionOrdinal([done("a", 9)], "new")).toBe(2);
    expect(shareSessionOrdinal([], "new")).toBe(1);
  });
});
