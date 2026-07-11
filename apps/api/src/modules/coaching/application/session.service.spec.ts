import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "../../../common/errors/error-code";
import { CoachingEventTopic } from "../domain/coaching.events";
import { SessionService } from "./session.service";
import type { RecentSummaryRow } from "../infrastructure/study-session.repository";

const USER = "u1";
const TODAY = new Date().toISOString().slice(0, 10);

/** withUserContext runs `db.transaction`, then SET LOCAL via `tx.execute`. */
const fakeDb = {
  transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> =>
    cb({ execute: async () => undefined }),
} as never;

function makeService(
  sessionsRepo: Record<string, ReturnType<typeof vi.fn> | unknown>,
  opts?: {
    planTasks?: Record<string, ReturnType<typeof vi.fn> | unknown>;
    activity?: Record<string, ReturnType<typeof vi.fn> | unknown>;
    events?: { emit: ReturnType<typeof vi.fn> };
    config?: { get: ReturnType<typeof vi.fn> };
  },
): SessionService {
  return new SessionService(
    fakeDb,
    sessionsRepo as never,
    (opts?.planTasks ?? { findById: vi.fn() }) as never,
    (opts?.activity ?? {}) as never,
    (opts?.events ?? { emit: () => {} }) as never,
    (opts?.config ?? { get: vi.fn(async () => 300) }) as never,
  );
}

describe("SessionService.start", () => {
  it("persists planTaskId when the task belongs to the user", async () => {
    const planTaskId = "00000000-0000-4000-8000-000000000001";
    const findById = vi.fn(async () => ({ id: planTaskId }));
    const create = vi.fn(async (_tx, data) => ({
      id: "s1",
      preset: data.preset,
      status: "IN_PROGRESS",
      subject: data.subject ?? null,
      planTaskId: data.planTaskId ?? null,
      startedAt: data.startedAt,
      endedAt: null,
      actualFocusSeconds: 0,
      plannedFocusMinutes: null,
      sessionMood: null,
      struggleNote: null,
      aiReflection: null,
    }));

    const result = await makeService({ create }, { planTasks: { findById } }).start(USER, {
      preset: "25_5",
      subject: "Tarih",
      planTaskId,
    });

    expect(findById).toHaveBeenCalledWith(expect.anything(), USER, planTaskId);
    expect(create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ planTaskId, subject: "Tarih" }),
    );
    expect(result.planTaskId).toBe(planTaskId);
  });

  it("rejects start when planTaskId does not belong to the user", async () => {
    const findById = vi.fn(async () => undefined);
    const create = vi.fn();

    await expect(
      makeService({ create }, { planTasks: { findById } }).start(USER, {
        preset: "25_5",
        planTaskId: "00000000-0000-4000-8000-000000000099",
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.COACHING_TASK_NOT_FOUND,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("starts without planTaskId when subject picker is used manually", async () => {
    const findById = vi.fn();
    const create = vi.fn(async (_tx, data) => ({
      id: "s1",
      preset: data.preset,
      status: "IN_PROGRESS",
      subject: data.subject ?? null,
      planTaskId: null,
      startedAt: data.startedAt,
      endedAt: null,
      actualFocusSeconds: 0,
      plannedFocusMinutes: null,
      sessionMood: null,
      struggleNote: null,
      aiReflection: null,
    }));

    const result = await makeService({ create }, { planTasks: { findById } }).start(USER, {
      preset: "25_5",
      subject: "Matematik",
    });

    expect(findById).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ planTaskId: null }),
    );
    expect(result.planTaskId).toBeNull();
  });
});

describe("SessionService.list", () => {
  it("includes planTaskTitle from the list join", async () => {
    const startedAt = new Date("2026-07-10T10:00:00Z");
    const endedAt = new Date("2026-07-10T10:25:00Z");
    const listPaged = vi.fn(async () => ({
      items: [
        {
          id: "s1",
          userId: USER,
          preset: "25_5",
          status: "COMPLETED",
          subject: "Coğrafya",
          planTaskId: "task-1",
          planTaskTitle: "Seans bağlantısı",
          startedAt,
          endedAt,
          actualFocusSeconds: 1500,
          plannedFocusMinutes: null,
          sessionMood: null,
          struggleNote: null,
          aiReflection: null,
          aiModel: null,
          aiReflectedAt: null,
          createdAt: startedAt,
          updatedAt: endedAt,
        },
      ],
      total: 1,
    }));

    const result = await makeService({ listPaged }).list(USER, { page: 1, pageSize: 5 });

    expect(result.items[0]?.planTaskTitle).toBe("Seans bağlantısı");
    expect(result.items[0]?.planTaskId).toBe("task-1");
  });
});

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

describe("SessionService.finalize", () => {
  const startedAt = new Date("2026-07-09T10:00:00Z");

  it("emits SESSION_COMPLETED when status is COMPLETED", async () => {
    const emit = vi.fn();
    const findById = vi.fn(async () => ({
      id: "s1",
      startedAt,
      endedAt: null,
    }));
    const update = vi.fn(async () => ({
      id: "s1",
      preset: "25_5",
      status: "COMPLETED",
      subject: null,
      startedAt,
      endedAt: new Date(),
      actualFocusSeconds: 1500,
      plannedFocusMinutes: null,
      sessionMood: null,
      struggleNote: null,
      aiReflection: null,
    }));
    const findByDate = vi.fn(async () => null);
    const hasCompletedOnDate = vi.fn(async () => true);
    const upsertHasSession = vi.fn(async () => undefined);

    await makeService(
      { findById, update, hasCompletedOnDate },
      { activity: { findByDate, upsertHasSession }, events: { emit } },
    ).finalize(USER, "s1", { status: "COMPLETED", actualFocusSeconds: 1500 });

    expect(emit).toHaveBeenCalledWith(
      CoachingEventTopic.SESSION_COMPLETED,
      expect.objectContaining({ userId: USER }),
    );
    expect(hasCompletedOnDate).toHaveBeenCalledWith(
      expect.anything(),
      USER,
      "2026-07-09",
      300,
    );
  });

  it("does not emit SESSION_COMPLETED when focus is below min threshold", async () => {
    const emit = vi.fn();
    const findById = vi.fn(async () => ({
      id: "s1",
      startedAt,
      endedAt: null,
    }));
    const update = vi.fn(async () => ({
      id: "s1",
      preset: "25_5",
      status: "COMPLETED",
      subject: null,
      startedAt,
      endedAt: new Date(),
      actualFocusSeconds: 60,
      plannedFocusMinutes: null,
      sessionMood: null,
      struggleNote: null,
      aiReflection: null,
    }));
    const findByDate = vi.fn(async () => null);
    const hasCompletedOnDate = vi.fn(async () => false);
    const upsertHasSession = vi.fn(async () => undefined);

    const result = await makeService(
      { findById, update, hasCompletedOnDate },
      { activity: { findByDate, upsertHasSession }, events: { emit } },
    ).finalize(USER, "s1", { status: "COMPLETED", actualFocusSeconds: 60 });

    expect(emit).not.toHaveBeenCalledWith(
      CoachingEventTopic.SESSION_COMPLETED,
      expect.anything(),
    );
    expect(result.countsAsFocusSession).toBe(false);
  });

  it("does not emit SESSION_COMPLETED when status is ABANDONED", async () => {
    const emit = vi.fn();
    const findById = vi.fn(async () => ({
      id: "s1",
      startedAt,
      endedAt: null,
    }));
    const update = vi.fn(async () => ({
      id: "s1",
      preset: "25_5",
      status: "ABANDONED",
      subject: null,
      startedAt,
      endedAt: new Date(),
      actualFocusSeconds: 300,
      plannedFocusMinutes: null,
      sessionMood: null,
      struggleNote: null,
      aiReflection: null,
    }));
    const findByDate = vi.fn(async () => ({ hasSession: true }));
    const hasCompletedOnDate = vi.fn(async () => false);
    const upsertHasSession = vi.fn(async () => undefined);

    await makeService(
      { findById, update, hasCompletedOnDate },
      { activity: { findByDate, upsertHasSession }, events: { emit } },
    ).finalize(USER, "s1", { status: "ABANDONED", actualFocusSeconds: 300 });

    expect(emit).not.toHaveBeenCalledWith(
      CoachingEventTopic.SESSION_COMPLETED,
      expect.anything(),
    );
  });

  it("auto-completes linked plan task when focus session completes", async () => {
    const emit = vi.fn();
    const planTaskId = "00000000-0000-4000-8000-000000000001";
    const findById = vi.fn(async () => ({
      id: "s1",
      planTaskId,
      startedAt,
      endedAt: null,
    }));
    const update = vi.fn(async () => ({
      id: "s1",
      preset: "25_5",
      status: "COMPLETED",
      subject: null,
      planTaskId,
      startedAt,
      endedAt: new Date(),
      actualFocusSeconds: 1500,
      plannedFocusMinutes: null,
      sessionMood: null,
      struggleNote: null,
      aiReflection: null,
    }));
    const findByDate = vi.fn(async () => null);
    const hasCompletedOnDate = vi.fn(async () => true);
    const upsertHasSession = vi.fn(async () => undefined);
    const upsertTasksDone = vi.fn(async () => undefined);
    const taskUpdate = vi.fn(async () => undefined);
    const countDone = vi.fn(async () => 1);
    const countTotal = vi.fn(async () => 1);
    const planFindById = vi.fn(async () => ({
      id: planTaskId,
      status: "PENDING",
      taskDate: TODAY,
    }));

    const result = await makeService(
      { findById, update, hasCompletedOnDate },
      {
        planTasks: { findById: planFindById, update: taskUpdate, countDone, countTotal },
        activity: { findByDate, upsertHasSession, upsertTasksDone },
        events: { emit },
      },
    ).finalize(USER, "s1", { status: "COMPLETED", actualFocusSeconds: 1500 });

    expect(taskUpdate).toHaveBeenCalledWith(expect.anything(), USER, planTaskId, {
      status: "DONE",
    });
    expect(upsertTasksDone).toHaveBeenCalledWith(expect.anything(), USER, TODAY, 1);
    expect(result.planTaskAutoCompleted).toBe(true);
    expect(emit).toHaveBeenCalledWith(
      CoachingEventTopic.PLAN_COMPLETED,
      expect.objectContaining({ userId: USER }),
    );
  });

  it("does not auto-complete plan task when focus is below min threshold", async () => {
    const planTaskId = "00000000-0000-4000-8000-000000000002";
    const taskUpdate = vi.fn();
    const planFindById = vi.fn(async () => ({
      id: planTaskId,
      status: "PENDING",
      taskDate: TODAY,
    }));
    const findById = vi.fn(async () => ({
      id: "s1",
      planTaskId,
      startedAt,
      endedAt: null,
    }));
    const update = vi.fn(async () => ({
      id: "s1",
      preset: "25_5",
      status: "COMPLETED",
      subject: null,
      planTaskId,
      startedAt,
      endedAt: new Date(),
      actualFocusSeconds: 60,
      plannedFocusMinutes: null,
      sessionMood: null,
      struggleNote: null,
      aiReflection: null,
    }));
    const findByDate = vi.fn(async () => null);
    const hasCompletedOnDate = vi.fn(async () => false);
    const upsertHasSession = vi.fn(async () => undefined);

    const result = await makeService(
      { findById, update, hasCompletedOnDate },
      {
        planTasks: { findById: planFindById, update: taskUpdate },
        activity: { findByDate, upsertHasSession },
      },
    ).finalize(USER, "s1", { status: "COMPLETED", actualFocusSeconds: 60 });

    expect(planFindById).not.toHaveBeenCalled();
    expect(taskUpdate).not.toHaveBeenCalled();
    expect(result.planTaskAutoCompleted).toBe(false);
  });

  it("does not auto-complete when linked plan task is already DONE", async () => {
    const planTaskId = "00000000-0000-4000-8000-000000000003";
    const taskUpdate = vi.fn();
    const planFindById = vi.fn(async () => ({
      id: planTaskId,
      status: "DONE",
      taskDate: TODAY,
    }));
    const findById = vi.fn(async () => ({
      id: "s1",
      planTaskId,
      startedAt,
      endedAt: null,
    }));
    const update = vi.fn(async () => ({
      id: "s1",
      preset: "25_5",
      status: "COMPLETED",
      subject: null,
      planTaskId,
      startedAt,
      endedAt: new Date(),
      actualFocusSeconds: 1500,
      plannedFocusMinutes: null,
      sessionMood: null,
      struggleNote: null,
      aiReflection: null,
    }));
    const findByDate = vi.fn(async () => null);
    const hasCompletedOnDate = vi.fn(async () => true);
    const upsertHasSession = vi.fn(async () => undefined);

    const result = await makeService(
      { findById, update, hasCompletedOnDate },
      {
        planTasks: { findById: planFindById, update: taskUpdate },
        activity: { findByDate, upsertHasSession },
      },
    ).finalize(USER, "s1", { status: "COMPLETED", actualFocusSeconds: 1500 });

    expect(taskUpdate).not.toHaveBeenCalled();
    expect(result.planTaskAutoCompleted).toBe(false);
  });
});
