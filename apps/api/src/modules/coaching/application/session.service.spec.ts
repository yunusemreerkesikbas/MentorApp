import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionService } from "./session.service";
import type { RecentSummaryRow } from "../infrastructure/study-session.repository";

const USER = "u1";

/** withUserContext runs `db.transaction`, then SET LOCAL via `tx.execute`. */
const fakeDb = {
  transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> =>
    cb({ execute: async () => undefined }),
} as never;

function makeService(
  sessionsRepo: Record<string, ReturnType<typeof vi.fn> | unknown>,
): SessionService {
  return new SessionService(
    fakeDb,
    sessionsRepo as never,
    {} as never,
    { emit: () => {} } as never,
  );
}

describe("SessionService.getRecentSummary", () => {
  let recentSummary: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    recentSummary = vi.fn();
  });

  it("shapes the PII-free summary: distinct subjects (capped), rounded minutes, last note", async () => {
    const raw: RecentSummaryRow = {
      count7d: 5,
      focusSeconds7d: 3630, // → 61 dk (rounded)
      recentRows: [
        { subject: "Matematik", struggleNote: "  paragraf  " },
        { subject: "Matematik", struggleNote: "türev" },
        { subject: "Tarih", struggleNote: null },
        { subject: "Coğrafya", struggleNote: null },
        { subject: "Vatandaşlık", struggleNote: null },
        { subject: "Türkçe", struggleNote: null }, // 5th distinct → dropped (cap 4)
      ],
    };
    recentSummary.mockResolvedValue(raw);

    const summary = await makeService({ recentSummary }).getRecentSummary(USER);

    expect(summary).not.toBeNull();
    expect(summary!.count7d).toBe(5);
    expect(summary!.focusMinutes7d).toBe(61);
    expect(summary!.subjects).toEqual(["Matematik", "Tarih", "Coğrafya", "Vatandaşlık"]);
    expect(summary!.lastStruggleNote).toBe("paragraf"); // most-recent non-empty, trimmed
  });

  it("returns null when there is no recent activity", async () => {
    recentSummary.mockResolvedValue({
      count7d: 0,
      focusSeconds7d: 0,
      recentRows: [],
    } satisfies RecentSummaryRow);

    expect(await makeService({ recentSummary }).getRecentSummary(USER)).toBeNull();
  });

  it("still summarizes older subjects/notes even when the 7-day count is zero", async () => {
    recentSummary.mockResolvedValue({
      count7d: 0,
      focusSeconds7d: 0,
      recentRows: [{ subject: "Fizik", struggleNote: "optik" }],
    } satisfies RecentSummaryRow);

    const summary = await makeService({ recentSummary }).getRecentSummary(USER);
    expect(summary).not.toBeNull();
    expect(summary!.count7d).toBe(0);
    expect(summary!.subjects).toEqual(["Fizik"]);
    expect(summary!.lastStruggleNote).toBe("optik");
  });
});

describe("SessionService.recordFeedback / setAiReflection", () => {
  it("clears the AI reflection cache when mood or note changes", async () => {
    const findById = vi.fn(async () => ({
      id: "s1",
      sessionMood: 1,
      struggleNote: null,
      endedAt: new Date(),
      aiReflection: "eski",
    }));
    const update = vi.fn(async (_tx: unknown, _u: string, _id: string, patch: Record<string, unknown>) => ({
      id: "s1",
      preset: "25_5",
      status: "COMPLETED",
      subject: null,
      startedAt: new Date(),
      endedAt: new Date(),
      actualFocusSeconds: 60,
      plannedFocusMinutes: null,
      sessionMood: patch.sessionMood,
      struggleNote: patch.struggleNote ?? null,
      aiReflection: patch.aiReflection ?? null,
    }));

    await makeService({ findById, update }).recordFeedback(USER, "s1", { mood: 3 });

    expect(update).toHaveBeenCalledWith(
      expect.anything(),
      USER,
      "s1",
      expect.objectContaining({
        sessionMood: 3,
        aiReflection: null,
        aiModel: null,
        aiReflectedAt: null,
      }),
    );
  });

  it("does not clear the cache when feedback is identical", async () => {
    const findById = vi.fn(async () => ({
      id: "s1",
      sessionMood: 2,
      struggleNote: "paragraf",
      endedAt: new Date(),
      aiReflection: "cached",
    }));
    const update = vi.fn(async (_tx: unknown, _u: string, _id: string, patch: Record<string, unknown>) => ({
      id: "s1",
      preset: "25_5",
      status: "COMPLETED",
      subject: null,
      startedAt: new Date(),
      endedAt: new Date(),
      actualFocusSeconds: 60,
      plannedFocusMinutes: null,
      sessionMood: 2,
      struggleNote: "paragraf",
      aiReflection: "cached",
      ...patch,
    }));

    await makeService({ findById, update }).recordFeedback(USER, "s1", {
      mood: 2,
      struggleNote: "paragraf",
    });

    const patch = update.mock.calls[0]![3] as Record<string, unknown>;
    expect(patch.aiReflection).toBeUndefined();
  });
});
