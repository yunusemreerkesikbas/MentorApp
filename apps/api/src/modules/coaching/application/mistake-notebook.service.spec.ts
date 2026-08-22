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
const STROKE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THREAD = "12121212-1212-4212-8212-121212121212";

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
    solutionStorageKey: null,
    solutionNote: null,
    status: "ACTIVE",
    source: "OWN",
    communityThreadId: null,
    communityAnsweredAt: null,
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
    createEntry: async (
      _tx: unknown,
      userId: string,
      input: Record<string, unknown>,
    ) => {
      const row = makeEntryRow({
        userId,
        ...input,
      } as Partial<MistakeNotebookEntryRow>);
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
      outcome: {
        nextReviewAt: Date | null;
        status: string;
        reviewCount: number;
      },
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
    countsFor: async () => ({
      entryCount: 0,
      dueCount: 0,
      healedCount: 0,
      pageCount: 0,
    }),
    findPage: async (_tx: unknown, _userId: string, index: number) => {
      const doc = pages.get(index);
      return doc ? { doc } : undefined;
    },
    upsertPage: async (
      _tx: unknown,
      _userId: string,
      index: number,
      doc: unknown,
    ) => {
      pages.set(index, doc);
      return { doc };
    },
    listEntries: async (
      _tx: unknown,
      userId: string,
      filters: {
        subjectRef?: string;
        errorType?: string;
        status?: string;
        page: number;
        pageSize: number;
      },
    ) => {
      const all = [...entries.values()]
        .filter((row) => row.userId === userId)
        .filter(
          (row) => !filters.subjectRef || row.subjectRef === filters.subjectRef,
        )
        .filter(
          (row) => !filters.errorType || row.errorType === filters.errorType,
        )
        .filter((row) => !filters.status || row.status === filters.status)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const start = (filters.page - 1) * filters.pageSize;
      return {
        items: all.slice(start, start + filters.pageSize),
        total: all.length,
      };
    },
    listAllReferencedImageKeys: async () =>
      [...entries.values()].flatMap((row) =>
        [row.storageKey, row.solutionStorageKey].filter(
          (key): key is string => key != null,
        ),
      ),
    linkThread: async (
      _tx: unknown,
      userId: string,
      id: string,
      threadId: string,
    ) => {
      const row = entries.get(id);
      if (!row || row.userId !== userId) return undefined;
      Object.assign(row, { communityThreadId: threadId });
      return row;
    },
    markThreadAnswered: async (_tx: unknown, threadId: string, at: Date) => {
      let marked = 0;
      for (const row of entries.values()) {
        if (row.communityThreadId === threadId) {
          Object.assign(row, { communityAnsweredAt: at });
          marked += 1;
        }
      }
      return marked;
    },
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
  const fake = {
    deleted,
    /** What the sweep sees in the bucket; set per test. */
    objects: [] as Array<{ key: string; lastModified: Date }>,
    listObjects: async () => fake.objects,
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
  return fake;
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
        source: "OWN",
      });

      expect(dto.nextReviewAt).not.toBeNull();
      const scheduled = new Date(dto.nextReviewAt!).getTime();
      const expected =
        before + NOTEBOOK_REVIEW_LADDER_DAYS[0]! * 24 * 60 * 60 * 1000;
      expect(scheduled).toBeGreaterThanOrEqual(expected - 5_000);
    });

    it("rejects a storage key under another user's prefix", async () => {
      await expect(
        ctx.service.createEntry(USER, {
          examId: EXAM,
          errorType: "CARELESS",
          source: "OWN",
          storageKey: `notebook/${OTHER}/${ITEM}.jpg`,
        }),
      ).rejects.toThrow();
    });

    it("rejects a topic sent without its subject", async () => {
      await expect(
        ctx.service.createEntry(USER, {
          examId: EXAM,
          errorType: "CARELESS",
          source: "OWN",
          topicRef: "problemler",
        }),
      ).rejects.toThrow();
    });

    it("rejects a subject slug that is not in the exam's taxonomy", async () => {
      await expect(
        ctx.service.createEntry(USER, {
          examId: EXAM,
          errorType: "CARELESS",
          source: "OWN",
          subjectRef: "uydurma-ders",
        }),
      ).rejects.toThrow();
    });

    it("resolves known slugs to display names", async () => {
      const dto = await ctx.service.createEntry(USER, {
        examId: EXAM,
        errorType: "UNKNOWN_TOPIC",
        source: "OWN",
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
        ctx.service.putPage(USER, -1, {
          version: 1,
          paper: "ruled",
          items: [],
        }),
      ).rejects.toThrow();
      expect(ctx.repo.pages.size).toBe(0);
    });
  });

  describe("getPage", () => {
    it("returns an empty page for one that was never saved — turning to a blank page is normal", async () => {
      const page = await ctx.service.getPage(USER, 3);
      expect(page).toEqual({
        pageIndex: 3,
        doc: { version: 1, paper: "ruled", items: [], ink: [] },
        entries: [],
      });
    });

    /*
     * Every page saved before drawing existed sits in jsonb without an `ink` key. The write
     * schema's `.default([])` never runs on the way out, so without the read-side fill the client
     * would get `undefined` where the type promises an array and the page would fail to render.
     */
    it("fills in fields a page predates rather than handing back the stored shape", async () => {
      ctx.repo.pages.set(0, { version: 1, paper: "grid", items: [] });

      const page = await ctx.service.getPage(USER, 0);

      expect(page.doc).toEqual({
        version: 1,
        paper: "grid",
        items: [],
        ink: [],
      });
    });

    it("keeps stored ink instead of defaulting over it", async () => {
      const stroke = {
        id: STROKE,
        tool: "pen",
        color: "#111111",
        size: 6,
        opacity: 1,
        points: [10, 10, 0.5, 20, 20, 0.5],
      };
      ctx.repo.pages.set(1, {
        version: 1,
        paper: "ruled",
        items: [],
        ink: [stroke],
      });

      const page = await ctx.service.getPage(USER, 1);

      expect(page.doc.ink).toEqual([stroke]);
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
      await expect(
        ctx.service.reviewEntry(USER, ENTRY, true),
      ).rejects.toThrow();
    });
  });

  describe("community bridge", () => {
    it("links a thread the caller owns and leaves it unanswered until somebody accepts", async () => {
      ctx.repo.entries.set(ENTRY, makeEntryRow());
      const dto = await ctx.service.linkCommunityThread(USER, ENTRY, THREAD);
      expect(dto.communityThreadId).toBe(THREAD);
      expect(dto.communityAnsweredAt).toBeNull();
    });

    it("refuses to link another user's entry", async () => {
      ctx.repo.entries.set(ENTRY, makeEntryRow({ userId: OTHER }));
      await expect(
        ctx.service.linkCommunityThread(USER, ENTRY, THREAD),
      ).rejects.toThrow();
    });

    it("marks every card on a thread — two students can ask the same question", async () => {
      ctx.repo.entries.set(ENTRY, makeEntryRow({ communityThreadId: THREAD }));
      ctx.repo.entries.set(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        makeEntryRow({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          userId: OTHER,
          communityThreadId: THREAD,
        }),
      );

      expect(await ctx.service.markCommunityAnswered(THREAD, new Date())).toBe(
        2,
      );
    });

    it("ignores a thread nobody linked", async () => {
      ctx.repo.entries.set(ENTRY, makeEntryRow());
      expect(await ctx.service.markCommunityAnswered(THREAD, new Date())).toBe(
        0,
      );
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

  describe("solution", () => {
    it("stores both halves and reads the photo back as a URL", async () => {
      const key = `notebook/${USER}/solution.jpg`;
      const dto = await ctx.service.createEntry(USER, {
        examId: EXAM,
        errorType: "CARELESS",
        source: "OWN",
        solutionStorageKey: key,
        solutionNote: "  Payda eşitlemem gerekiyordu.  ",
      });

      expect(dto.solutionStorageKey).toBe(key);
      expect(dto.solutionUrl).toBe(`https://cdn.test/${key}`);
      // Trimmed on the way in, like `note` — the same field on the same card.
      expect(dto.solutionNote).toBe("Payda eşitlemem gerekiyordu.");
    });

    it("rejects a solution key under another user's prefix", async () => {
      // The presigned PUT is minted per upload, but the key that lands in the row comes from the
      // body — without the guard an entry could point at somebody else's object and serve it.
      await expect(
        ctx.service.createEntry(USER, {
          examId: EXAM,
          errorType: "CARELESS",
          source: "OWN",
          solutionStorageKey: `notebook/${OTHER}/${ITEM}.jpg`,
        }),
      ).rejects.toThrow();
    });

    it("is patchable during review, which is when the answer is usually learned", async () => {
      ctx.repo.entries.set(ENTRY, makeEntryRow({}));

      const dto = await ctx.service.updateEntry(USER, ENTRY, {
        solutionNote: "Kökü içeri alırken işaret değişiyor.",
      });

      expect(dto.solutionNote).toBe("Kökü içeri alırken işaret değişiyor.");
    });

    /*
     * Status and schedule are one move. The due scan reads `nextReviewAt` and never the status, so
     * writing one without the other produced a card that was archived and still due, or reactivated
     * and never due again.
     */
    describe("status", () => {
      it("archiving takes the card out of the due scan", async () => {
        ctx.repo.entries.set(ENTRY, makeEntryRow({}));

        const dto = await ctx.service.updateEntry(USER, ENTRY, {
          status: "ARCHIVED",
        });

        expect(dto.status).toBe("ARCHIVED");
        expect(dto.nextReviewAt).toBeNull();
      });

      it("reactivating gives the card a date again and starts the ladder over", async () => {
        ctx.repo.entries.set(
          ENTRY,
          makeEntryRow({
            status: "ARCHIVED",
            nextReviewAt: null,
            reviewCount: 2,
          }),
        );

        const dto = await ctx.service.updateEntry(USER, ENTRY, {
          status: "ACTIVE",
        });

        expect(dto.status).toBe("ACTIVE");
        expect(dto.nextReviewAt).not.toBeNull();
        // Resuming at rung two would heal the card on its next correct answer, which is exactly
        // what the student said they did not trust.
        expect(dto.reviewCount).toBe(0);
      });

      it("brings a healed card back the same way", async () => {
        ctx.repo.entries.set(
          ENTRY,
          makeEntryRow({
            status: "HEALED",
            nextReviewAt: null,
            reviewCount: 3,
          }),
        );

        const dto = await ctx.service.updateEntry(USER, ENTRY, {
          status: "ACTIVE",
        });

        expect(dto.status).toBe("ACTIVE");
        expect(dto.nextReviewAt).not.toBeNull();
        expect(dto.reviewCount).toBe(0);
      });

      it("leaves the schedule alone when the status is not actually changing", async () => {
        const due = new Date("2026-08-16T09:00:00.000Z");
        ctx.repo.entries.set(
          ENTRY,
          makeEntryRow({ nextReviewAt: due, reviewCount: 2 }),
        );

        // An editor that always sends the whole form must not reset a card's place in the ladder
        // just by saving a label.
        const dto = await ctx.service.updateEntry(USER, ENTRY, {
          status: "ACTIVE",
          note: "aynı",
        });

        expect(dto.nextReviewAt).toBe(due.toISOString());
        expect(dto.reviewCount).toBe(2);
      });
    });
  });

  describe("listEntries", () => {
    /** Three of the caller's own, plus one belonging to somebody else. */
    function seedIndex() {
      ctx.repo.entries.set(
        "e1",
        makeEntryRow({
          id: "e1",
          subjectRef: "matematik",
          errorType: "CARELESS",
          createdAt: new Date("2026-08-01T09:00:00.000Z"),
        }),
      );
      ctx.repo.entries.set(
        "e2",
        makeEntryRow({
          id: "e2",
          subjectRef: "tarih",
          errorType: "TIME",
          status: "HEALED",
          createdAt: new Date("2026-08-02T09:00:00.000Z"),
        }),
      );
      ctx.repo.entries.set(
        "e3",
        makeEntryRow({
          id: "e3",
          subjectRef: "matematik",
          errorType: "TIME",
          createdAt: new Date("2026-08-03T09:00:00.000Z"),
        }),
      );
      ctx.repo.entries.set("e4", makeEntryRow({ id: "e4", userId: OTHER }));
    }

    it("returns the caller's own entries, newest first", async () => {
      seedIndex();
      const result = await ctx.service.listEntries(USER, {
        page: 1,
        pageSize: 20,
      });

      expect(result.items.map((entry) => entry.id)).toEqual(["e3", "e2", "e1"]);
      expect(result.total).toBe(3);
    });

    it("filters by subject, error type and status independently", async () => {
      seedIndex();

      const bySubject = await ctx.service.listEntries(USER, {
        page: 1,
        pageSize: 20,
        subjectRef: "matematik",
      });
      expect(bySubject.items.map((entry) => entry.id)).toEqual(["e3", "e1"]);

      const byError = await ctx.service.listEntries(USER, {
        page: 1,
        pageSize: 20,
        errorType: "TIME",
      });
      expect(byError.items.map((entry) => entry.id)).toEqual(["e3", "e2"]);

      const byStatus = await ctx.service.listEntries(USER, {
        page: 1,
        pageSize: 20,
        status: "HEALED",
      });
      expect(byStatus.items.map((entry) => entry.id)).toEqual(["e2"]);
    });

    it("pages without losing the total", async () => {
      seedIndex();
      const page2 = await ctx.service.listEntries(USER, {
        page: 2,
        pageSize: 2,
      });

      expect(page2.items.map((entry) => entry.id)).toEqual(["e1"]);
      // The count is of everything that matches, not of the slice — the caller needs it to know
      // whether asking for another page is worth it.
      expect(page2.total).toBe(3);
      expect(page2.page).toBe(2);
    });
  });

  describe("orphan sweep", () => {
    it("keeps a solution photo, which nothing else in the row references", async () => {
      // The sweep deletes every object the repository does not name. A solution photo lives under
      // the same `notebook/` prefix as the question photo, so leaving its column out of that query
      // would delete every stored answer a day after it was saved.
      const solution = `notebook/${USER}/solution.jpg`;
      const stale = `notebook/${USER}/abandoned.jpg`;
      ctx.repo.entries.set(
        ENTRY,
        makeEntryRow({ storageKey: null, solutionStorageKey: solution }),
      );
      const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
      ctx.storage.objects = [
        { key: solution, lastModified: old },
        { key: stale, lastModified: old },
      ];

      const result = await ctx.service.cleanupOrphanImages();

      expect(ctx.storage.deleted).toEqual([stale]);
      expect(result.deleted).toBe(1);
    });
  });
});
