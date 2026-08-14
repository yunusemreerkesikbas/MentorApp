import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NOTEBOOK_REVIEW_LINK,
  NotebookReviewReminderService,
} from "./notebook-review-reminder.service";
import type { NotebookReviewCandidate } from "../../coaching/domain/coaching-query.port";

const USER = "55555555-5555-4555-8555-555555555555";
const OTHER = "66666666-6666-4666-8666-666666666666";

const fakeDb = {
  transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> =>
    cb({ execute: async () => undefined }),
} as never;

function candidate(userId: string, dueCount: number): NotebookReviewCandidate {
  return { userId, email: `${userId}@test.local`, displayName: "Test", dueCount };
}

function makeService(options: {
  candidates: NotebookReviewCandidate[];
  /** Second call for the same user returns false, as the real unique index does. */
  alreadySent?: Set<string>;
  pushEnabled?: boolean;
}) {
  const sentKeys = options.alreadySent ?? new Set<string>();
  const enqueued: Array<{ name: string; payload: Record<string, unknown> }> = [];
  const inApp: Array<{ userId: string; body: string; link: string }> = [];

  const service = new NotebookReviewReminderService(
    fakeDb,
    {
      enqueue: async (name: string, payload: Record<string, unknown>) => {
        enqueued.push({ name, payload });
      },
    } as never,
    {
      listNotebookReviewCandidates: async () => options.candidates,
      listDailyReminderCandidates: async () => [],
    } as never,
    {
      findByUserIdService: async () => ({
        pushEnabled: options.pushEnabled ?? true,
      }),
    } as never,
    {
      tryRecord: async (_tx: unknown, input: { userId: string; dedupeKey: string }) => {
        const key = `${input.userId}:${input.dedupeKey}`;
        if (sentKeys.has(key)) return false;
        sentKeys.add(key);
        return true;
      },
    } as never,
    {
      createInApp: async (
        userId: string,
        _kind: string,
        _title: string,
        body: string,
        link: string,
      ) => {
        inApp.push({ userId, body, link });
      },
    } as never,
  );

  return { service, enqueued, inApp, sentKeys };
}

describe("NotebookReviewReminderService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends one nudge per user, carrying the count — never one per due entry", async () => {
    const ctx = makeService({ candidates: [candidate(USER, 4)] });

    const result = await ctx.service.dispatchDue();

    expect(result).toEqual({ sent: 1, skipped: 0 });
    expect(ctx.inApp).toHaveLength(1);
    expect(ctx.inApp[0]!.body).toContain("4");
    expect(ctx.inApp[0]!.link).toBe(NOTEBOOK_REVIEW_LINK);
  });

  it("uses the singular sentence for a single due entry", async () => {
    const ctx = makeService({ candidates: [candidate(USER, 1)] });
    await ctx.service.dispatchDue();
    expect(ctx.inApp[0]!.body).not.toMatch(/\d/);
  });

  it("is idempotent within a day, so a re-run of the cron cannot double-nudge", async () => {
    const ctx = makeService({ candidates: [candidate(USER, 2)] });

    await ctx.service.dispatchDue();
    const second = await ctx.service.dispatchDue();

    expect(second).toEqual({ sent: 0, skipped: 1 });
    expect(ctx.inApp).toHaveLength(1);
  });

  it("still writes the in-app inbox when push is off, but enqueues no push", async () => {
    const ctx = makeService({
      candidates: [candidate(USER, 3)],
      pushEnabled: false,
    });

    await ctx.service.dispatchDue();

    expect(ctx.inApp).toHaveLength(1);
    expect(ctx.enqueued).toHaveLength(0);
  });

  it("deep-links push straight into the review flow", async () => {
    const ctx = makeService({ candidates: [candidate(OTHER, 2)] });
    await ctx.service.dispatchDue();
    expect(ctx.enqueued[0]!.payload.url).toBe(NOTEBOOK_REVIEW_LINK);
  });
});
