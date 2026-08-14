import { beforeEach, describe, expect, it } from "vitest";
import { MistakeNotebookService } from "./mistake-notebook.service";
import type { MistakeNotebookEntryRow } from "../infrastructure/mistake-notebook.repository";
import { NOTEBOOK_REVIEW_LADDER_DAYS } from "../domain/notebook-review.policy";

/** Real uuids, not "u1": notebook storage keys embed the user id and the schema checks its shape. */
const USER = "55555555-5555-4555-8555-555555555555";
const OTHER = "66666666-6666-4666-8666-666666666666";
const EXAM = "77777777-7777-4777-8777-777777777777";
const ENTRY = "88888888-8888-4888-8888-888888888888";
const ITEM = "99999999-9999-4999-8999-999999999999";

const fakeDb = {
  transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> =>
    cb({ execute: async () => undefined }),
} as never;

function makeEntryRow(patch: Partial<MistakeNotebookEntryRow> = {}) {
  return {
    id: ENTRY,
    userId: USER,
    examId: EXAM,
    mockExamId: null,
    storageKey: null,
    subjectRef: null,
    topicRef: null,
    errorType: "CARELESS",
    note: null,
    status: "ACTIVE",
    reviewCount: 0,
    lastReviewedAt: null,
    nextReviewAt: new Date("2026-08-16T09:00:00.000Z"),
    createdAt: new Date("2026-08-14T09:00:00.000Z"),
    updatedAt: new Date("2026-08-14T09:00:00.000Z"),
    ...patch,
  } as MistakeNotebookEntryRow;
}

function makeRepoFake() {
  const entries = new Map<string, MistakeNotebookEntryRow>();
  const pages = new Map<number, unknown>();
  return {
    entries,
    pages,
    createEntry: async (_tx: unknown, userId: string, input: Record<string, unknown>) => {
      const row = makeEntryRow({ userId, ...input } as Partial<MistakeNotebookEntryRow>);
      entries.set(row.id, row);
      return row;
    },
    findEntry: async (_tx: unknown, userId: string, id: string) => {
      const row = entries.get(id);
      return row && row.userId === userId ? row : undefined;
    },
    listEntriesByIds: async (_tx: unknown, userId: string, ids: string[]) =>
      ids.flatMap((id) => {
        const row = entries.get(id);
        return row && row.userId === userId ? [row] : [];
      }),
    listDueEntries: async () => [],
    updateEntry: async (
      _tx: unknown,
      userId: string,
      id: string,
      patch: Record<string, unknown>,
    ) => {
      const row = entries.get(id);
      if (!row || row.userId !== userId) return undefined;
      Object.assign(row, patch);
      return row;
    },
    recordReview: async (
      _tx: unknown,
      userId: string,
      id: string,
      outcome: { nextReviewAt: Date | null; status: string; reviewCount: number },
      reviewedAt: Date,
    ) => {
      const row = entries.get(id);
      if (!row || row.userId !== userId) return undefined;
      Object.assign(row, { ...outcome, lastReviewedAt: reviewedAt });
      return row;
    },
    deleteEntry: async (_tx: unknown, userId: string, id: string) => {
      const row = entries.get(id);
      if (!row || row.userId !== userId) return undefined;
      entries.delete(id);
      return row;
    },
    countsFor: async () => ({ entryCount: 0, dueCount: 0, healedCount: 0, pageCount: 0 }),
    findPage: async (_tx: unknown, _userId: string, index: number) => {
      const doc = pages.get(index);
      return doc ? { doc } : undefined;
    },
    upsertPage: async (_tx: unknown, _userId: string, index: number, doc: unknown) => {
      pages.set(index, doc);
      return { doc };
    },
    listAllReferencedImageKeys: async () => [],
  };
}

function makeContentFake() {
  return {
    getValidSubjectSlugsForExam: async () => new Set(["matematik"]),
    listExamTopicsByExamId: async () => [
      { subjectSlug: "matematik", slug: "problemler", name: "Problemler" },
    ],
    listExamSubjectsByExamId: async () => [
      { slug: "matematik", name: "Matematik" },
    ],
  };
}

function makeStorageFake() {
  const deleted: string[] = [];
  return {
    deleted,
    getPublicUrl: (key: string) => `https://cdn.test/${key}`,
    createUploadUrl: async ({ key }: { key: string }) => ({
      url: `https://upload.test/${key}`,
      key,
      expiresAt: "2026-08-14T10:00:00.000Z",
    }),
    deleteObject: async (key: string) => {
      deleted.push(key);
    },
  };
}

function makeService() {
  const repo = makeRepoFake();
  const storage = makeStorageFake();
  const service = new MistakeNotebookService(
    fakeDb,
    repo as never,
    makeContentFake() as never,
    storage as never,
  );
  return { service, repo, storage };
}

describe("MistakeNotebookService", () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  describe("createEntry", () => {
    it("schedules the first review, so nothing enters the book unscheduled", async () => {
      const before = Date.now();
      const dto = await ctx.service.createEntry(USER, {
        examId: EXAM,
        errorType: "CARELESS",
      });

      expect(dto.nextReviewAt).not.toBeNull();
      const scheduled = new Date(dto.nextReviewAt!).getTime();
      const expected = before + NOTEBOOK_REVIEW_LADDER_DAYS[0]! * 24 * 60 * 60 * 1000;
      expect(scheduled).toBeGreaterThanOrEqual(expected - 5_000);
    });

    it("rejects a storage key under another user's prefix", async () => {
      await expect(
        ctx.service.createEntry(USER, {
          examId: EXAM,
          errorType: "CARELESS",
          storageKey: `notebook/${OTHER}/${ITEM}.jpg`,
        }),
      ).rejects.toThrow();
    });

    it("rejects a topic sent without its subject", async () => {
      await expect(
        ctx.service.createEntry(USER, {
          examId: EXAM,
          errorType: "CARELESS",
          topicRef: "problemler",
        }),
      ).rejects.toThrow();
    });

    it("rejects a subject slug that is not in the exam's taxonomy", async () => {
      await expect(
        ctx.service.createEntry(USER, {
          examId: EXAM,
          errorType: "CARELESS",
          subjectRef: "uydurma-ders",
        }),
      ).rejects.toThrow();
    });

    it("resolves known slugs to display names", async () => {
      const dto = await ctx.service.createEntry(USER, {
        examId: EXAM,
        errorType: "UNKNOWN_TOPIC",
        subjectRef: "matematik",
        topicRef: "problemler",
      });
      expect(dto.subjectName).toBe("Matematik");
      expect(dto.topicName).toBe("Problemler");
    });
  });

  describe("putPage", () => {
    it("refuses a document referencing an entry the caller does not own", async () => {
      ctx.repo.entries.set(ENTRY, makeEntryRow({ userId: OTHER }));

      await expect(
        ctx.service.putPage(USER, 0, {
          version: 1,
          paper: "ruled",
          items: [
            {
              id: ITEM,
              kind: "entry",
              entryId: ENTRY,
              x: 0,
              y: 0,
              width: 100,
              height: 100,
              rotation: 0,
              opacity: 1,
              z: 0,
            },
          ],
        }),
      ).rejects.toThrow();
      expect(ctx.repo.pages.size).toBe(0);
    });

    it("rejects an out-of-range page index before touching the database", async () => {
      await expect(
        ctx.service.putPage(USER, -1, { version: 1, paper: "ruled", items: [] }),
      ).rejects.toThrow();
      expect(ctx.repo.pages.size).toBe(0);
    });
  });

  describe("getPage", () => {
    it("returns an empty page for one that was never saved — turning to a blank page is normal", async () => {
      const page = await ctx.service.getPage(USER, 3);
      expect(page).toEqual({
        pageIndex: 3,
        doc: { version: 1, paper: "ruled", items: [] },
        entries: [],
      });
    });
  });

  describe("reviewEntry", () => {
    it("climbs a rung when solved", async () => {
      ctx.repo.entries.set(ENTRY, makeEntryRow({ reviewCount: 0 }));
      const dto = await ctx.service.reviewEntry(USER, ENTRY, true);
      expect(dto.reviewCount).toBe(1);
      expect(dto.status).toBe("ACTIVE");
      expect(dto.lastReviewedAt).not.toBeNull();
    });

    it("heals off the top rung and leaves the due query", async () => {
      ctx.repo.entries.set(
        ENTRY,
        makeEntryRow({ reviewCount: NOTEBOOK_REVIEW_LADDER_DAYS.length - 1 }),
      );
      const dto = await ctx.service.reviewEntry(USER, ENTRY, true);
      expect(dto.status).toBe("HEALED");
      expect(dto.nextReviewAt).toBeNull();
    });

    it("does not review another user's entry", async () => {
      ctx.repo.entries.set(ENTRY, makeEntryRow({ userId: OTHER }));
      await expect(ctx.service.reviewEntry(USER, ENTRY, true)).rejects.toThrow();
    });
  });

  describe("deleteEntry", () => {
    it("removes the photo object so a deleted mistake stops living at a public URL", async () => {
      const key = `notebook/${USER}/${ITEM}.jpg`;
      ctx.repo.entries.set(ENTRY, makeEntryRow({ storageKey: key }));

      await ctx.service.deleteEntry(USER, ENTRY);

      expect(ctx.repo.entries.has(ENTRY)).toBe(false);
      expect(ctx.storage.deleted).toEqual([key]);
    });
  });

  describe("createUploadUrl", () => {
    it("scopes the key to the caller's own prefix", async () => {
      const result = await ctx.service.createUploadUrl(USER, "image/jpeg");
      expect(result.key.startsWith(`notebook/${USER}/`)).toBe(true);
      expect(result.key.endsWith(".jpg")).toBe(true);
    });
  });
});
