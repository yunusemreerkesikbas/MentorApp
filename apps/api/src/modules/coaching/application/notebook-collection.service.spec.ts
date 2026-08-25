import { describe, expect, it } from "vitest";
import { MistakeNotebookService } from "./mistake-notebook.service";

const USER = "55555555-5555-4555-8555-555555555555";
const NOTEBOOK = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EXAM = "77777777-7777-4777-8777-777777777777";
const ENTRY = "88888888-8888-4888-8888-888888888888";

const fakeDb = {
  transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> =>
    callback({ execute: async () => undefined }),
} as never;

interface FakeNotebookRow {
  id: string;
  userId: string;
  orgId: string | null;
  kind: "MISTAKE" | "CUSTOM";
  examId: string | null;
  subjectRef: string | null;
  title: string | null;
  coverColor: "navy";
  coverMaterial: "cloth";
  createdAt: Date;
  updatedAt: Date;
  pageCount: number;
}

function makeRepository() {
  const notebooks = new Map<string, FakeNotebookRow>();
  const pages = new Map<string, unknown>();
  let sequence = 0;

  return {
    notebooks,
    pages,
    ensureMistakeNotebook: async (
      _tx: unknown,
      userId: string,
      orgId: string | null,
    ) => {
      const existing = [...notebooks.values()].find(
        (row) => row.userId === userId && row.kind === "MISTAKE",
      );
      if (existing) return existing;
      const row: FakeNotebookRow = {
        id: NOTEBOOK,
        userId,
        orgId,
        kind: "MISTAKE",
        examId: null,
        subjectRef: null,
        title: null,
        coverColor: "navy",
        coverMaterial: "cloth",
        createdAt: new Date("2026-08-25T09:00:00.000Z"),
        updatedAt: new Date("2026-08-25T09:00:00.000Z"),
        pageCount: 0,
      };
      notebooks.set(row.id, row);
      return row;
    },
    listNotebooks: async (
      _tx: unknown,
      userId: string,
      query: { page: number; pageSize: number },
    ) => {
      const all = [...notebooks.values()]
        .filter((row) => row.userId === userId)
        .sort((a, b) => {
          if (a.kind !== b.kind) return a.kind === "MISTAKE" ? -1 : 1;
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        });
      const start = (query.page - 1) * query.pageSize;
      return {
        items: all.slice(start, start + query.pageSize),
        total: all.length,
      };
    },
    createNotebook: async (
      _tx: unknown,
      userId: string,
      orgId: string | null,
      input: Omit<
        FakeNotebookRow,
        | "id"
        | "userId"
        | "orgId"
        | "kind"
        | "createdAt"
        | "updatedAt"
        | "pageCount"
      >,
    ) => {
      sequence += 1;
      const row: FakeNotebookRow = {
        id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(sequence).padStart(12, "0")}`,
        userId,
        orgId,
        kind: "CUSTOM",
        ...input,
        createdAt: new Date("2026-08-25T10:00:00.000Z"),
        updatedAt: new Date("2026-08-25T10:00:00.000Z"),
        pageCount: 0,
      };
      notebooks.set(row.id, row);
      return row;
    },
    findNotebook: async (_tx: unknown, userId: string, id: string) => {
      const row = notebooks.get(id);
      return row?.userId === userId ? row : undefined;
    },
    deleteNotebook: async (_tx: unknown, userId: string, id: string) => {
      const row = notebooks.get(id);
      if (!row || row.userId !== userId) return undefined;
      notebooks.delete(id);
      return row;
    },
    findPage: async (
      _tx: unknown,
      _userId: string,
      notebookId: string,
      index: number,
    ) => {
      const doc = pages.get(`${notebookId}:${index}`);
      return doc ? { doc } : undefined;
    },
    upsertPage: async (
      _tx: unknown,
      _userId: string,
      notebookId: string,
      index: number,
      doc: unknown,
    ) => {
      pages.set(`${notebookId}:${index}`, doc);
      return { doc };
    },
    listEntriesByIds: async () => [],
    countsFor: async () => ({
      entryCount: 0,
      dueCount: 0,
      healedCount: 0,
      pageCount: 0,
    }),
  };
}

function makeService() {
  const repository = makeRepository();
  const content = {
    getValidSubjectSlugsForExam: async () => new Set(["matematik"]),
    listExamTopicsByExamId: async () => [],
    listExamSubjectsByExamId: async () => [
      { slug: "matematik", name: "Matematik" },
    ],
  };
  const storage = { getPublicUrl: (key: string) => key };
  const service = new MistakeNotebookService(
    fakeDb,
    repository as never,
    content as never,
    storage as never,
  );
  return { service, repository };
}

describe("notebook collection", () => {
  it("creates one system mistake notebook when the collection is first listed", async () => {
    const { service, repository } = makeService();

    const first = await service.listNotebooks(
      { userId: USER, orgId: null },
      { page: 1, pageSize: 12 },
    );
    const second = await service.listNotebooks(
      { userId: USER, orgId: null },
      { page: 1, pageSize: 12 },
    );

    expect(first.items).toHaveLength(1);
    expect(first.items[0]).toMatchObject({ id: NOTEBOOK, kind: "MISTAKE" });
    expect(second.items).toHaveLength(1);
    expect(repository.notebooks.size).toBe(1);
  });

  it("creates a subject notebook and returns its ready-to-render subject name", async () => {
    const { service } = makeService();

    const created = await service.createNotebook(
      { userId: USER, orgId: null },
      {
        title: "Matematik Notlarım",
        examId: EXAM,
        subjectRef: "matematik",
        cover: { color: "navy", material: "cloth" },
      },
    );

    expect(created).toMatchObject({
      kind: "CUSTOM",
      title: "Matematik Notlarım",
      subjectRef: "matematik",
      subjectName: "Matematik",
    });
  });

  it("does not delete the protected system mistake notebook", async () => {
    const { service } = makeService();
    const listed = await service.listNotebooks(
      { userId: USER, orgId: null },
      { page: 1, pageSize: 12 },
    );

    await expect(
      service.deleteNotebook(USER, listed.items[0]!.id),
    ).rejects.toThrow();
  });

  it("rejects mistake entry cards on a custom notebook page", async () => {
    const { service, repository } = makeService();
    repository.notebooks.set(NOTEBOOK, {
      id: NOTEBOOK,
      userId: USER,
      orgId: null,
      kind: "CUSTOM",
      examId: null,
      subjectRef: null,
      title: "Notlarım",
      coverColor: "navy",
      coverMaterial: "cloth",
      createdAt: new Date(),
      updatedAt: new Date(),
      pageCount: 0,
    });

    await expect(
      service.putNotebookPage(USER, NOTEBOOK, 0, {
        version: 1,
        paper: "ruled",
        items: [
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            kind: "entry",
            entryId: ENTRY,
            x: 0,
            y: 0,
            width: 200,
            height: 260,
            rotation: 0,
            z: 1,
          },
        ],
        ink: [],
      }),
    ).rejects.toThrow();
  });
});
