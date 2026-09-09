import { describe, expect, it, vi } from "vitest";
import { PlanService } from "./plan.service";

const STUDENT_A = "00000000-0000-4000-8000-000000000002";
const STUDENT_B = "00000000-0000-4000-8000-000000000003";
const LINK_A = "00000000-0000-4000-8000-000000000012";
const LINK_B = "00000000-0000-4000-8000-000000000013";
const GROUP = "00000000-0000-4000-8000-000000000020";
const TODAY = new Date().toISOString().slice(0, 10);

type Row = {
  id: string;
  userId: string;
  taskDate: string;
  title: string;
  subject: string | null;
  topic: string | null;
  status: "PENDING" | "DONE";
  sortOrder: number;
  startTime: string | null;
  endTime: string | null;
  description: string | null;
  coachNote: string | null;
  originType: string | null;
  originRefId: string | null;
  originMeta: null;
  assignmentGroupId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function row(overrides: Partial<Row>): Row {
  return {
    id: crypto.randomUUID(),
    userId: STUDENT_A,
    taskDate: TODAY,
    title: "Paragraf",
    subject: "Türkçe",
    topic: null,
    status: "PENDING",
    sortOrder: 0,
    startTime: null,
    endTime: null,
    description: null,
    coachNote: null,
    originType: "MENTORSHIP",
    originRefId: LINK_A,
    originMeta: null,
    assignmentGroupId: GROUP,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function setup(initial: Row[] = [], failStudentId?: string) {
  const rows = [...initial];
  const lockOrder: string[] = [];
  const db = {
    transaction: vi.fn(async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
      const snapshot = rows.map((item) => ({ ...item }));
      try {
        return await callback({ execute: vi.fn() });
      } catch (error) {
        rows.splice(0, rows.length, ...snapshot);
        throw error;
      }
    }),
  };
  const tasks = {
    acquireUserLock: vi.fn(async (_tx, studentId: string) => {
      lockOrder.push(studentId);
    }),
    create: vi.fn(async (_tx, data: Partial<Row>) => {
      if (data.userId === failStudentId) throw new Error("write failed");
      const created = row({
        ...data,
        id: crypto.randomUUID(),
        status: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      rows.push(created);
      return created;
    }),
    updatePendingMentorshipTask: vi.fn(
      async (
        _tx,
        scope: { studentId: string; mentorshipLinkId: string },
        taskId: string,
        patch: Partial<Row>,
      ) => {
        const found = rows.find(
          (item) =>
            item.id === taskId &&
            item.userId === scope.studentId &&
            item.originRefId === scope.mentorshipLinkId &&
            item.status === "PENDING",
        );
        if (found) Object.assign(found, patch);
        return found;
      },
    ),
    updatePendingMentorshipGroup: vi.fn(
      async (
        _tx,
        scopes: Array<{ studentId: string; mentorshipLinkId: string }>,
        groupId: string,
        patch: Partial<Row>,
      ) => {
        const allowed = new Set(
          scopes.map((scope) => `${scope.studentId}:${scope.mentorshipLinkId}`),
        );
        const affected = rows.filter(
          (item) =>
            item.assignmentGroupId === groupId &&
            item.status === "PENDING" &&
            allowed.has(`${item.userId}:${item.originRefId}`),
        );
        affected.forEach((item) => Object.assign(item, patch));
        return affected;
      },
    ),
    deletePendingMentorshipTask: vi.fn(
      async (
        _tx,
        scope: { studentId: string; mentorshipLinkId: string },
        taskId: string,
      ) => {
        const index = rows.findIndex(
          (item) =>
            item.id === taskId &&
            item.userId === scope.studentId &&
            item.originRefId === scope.mentorshipLinkId &&
            item.status === "PENDING",
        );
        if (index < 0) return undefined;
        return rows.splice(index, 1)[0];
      },
    ),
    deletePendingMentorshipGroup: vi.fn(
      async (
        _tx,
        scopes: Array<{ studentId: string; mentorshipLinkId: string }>,
        groupId: string,
      ) => {
        const allowed = new Set(
          scopes.map((scope) => `${scope.studentId}:${scope.mentorshipLinkId}`),
        );
        const removed: Row[] = [];
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          const item = rows[index]!;
          if (
            item.assignmentGroupId === groupId &&
            item.status === "PENDING" &&
            allowed.has(`${item.userId}:${item.originRefId}`)
          ) {
            removed.push(...rows.splice(index, 1));
          }
        }
        return removed;
      },
    ),
  };
  const service = new PlanService(
    db as never,
    tasks as never,
    { upsertTasksDone: vi.fn() } as never,
    { emit: vi.fn() } as never,
  );
  return { service, tasks, rows, lockOrder, db };
}

describe("PlanService W8 assignment seams", () => {
  it("creates one grouped task per student atomically with stable lock order", async () => {
    const { service, rows, lockOrder } = setup();

    const created = await service.createMentorshipBatch(
      [
        { studentId: STUDENT_B, mentorshipLinkId: LINK_B },
        { studentId: STUDENT_A, mentorshipLinkId: LINK_A },
      ],
      { title: "Paragraf", coachNote: "20 soru" },
    );

    expect(lockOrder).toEqual([STUDENT_A, STUDENT_B]);
    expect(created).toHaveLength(2);
    expect(new Set(rows.map((item) => item.assignmentGroupId)).size).toBe(1);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: STUDENT_A,
          originRefId: LINK_A,
          description: null,
        }),
        expect.objectContaining({
          userId: STUDENT_B,
          originRefId: LINK_B,
          description: null,
        }),
      ]),
    );
  });

  it("rolls every student back when one batch write fails", async () => {
    const { service, rows } = setup([], STUDENT_B);

    await expect(
      service.createMentorshipBatch(
        [
          { studentId: STUDENT_A, mentorshipLinkId: LINK_A },
          { studentId: STUDENT_B, mentorshipLinkId: LINK_B },
        ],
        { title: "Paragraf" },
      ),
    ).rejects.toThrow("write failed");

    expect(rows).toEqual([]);
  });

  it("updates only the pending task matching student and authorized link", async () => {
    const pending = row({ id: "pending" });
    const completed = row({ id: "done", status: "DONE" });
    const { service, rows } = setup([pending, completed]);

    await service.updateMentorshipTask(
      { studentId: STUDENT_A, mentorshipLinkId: LINK_A },
      pending.id,
      {
        title: "Yeni başlık",
        coachNote: "Yeni not",
        status: "DONE",
        description: "student-private",
      } as never,
    );

    expect(rows[0]).toMatchObject({
      title: "Yeni başlık",
      coachNote: "Yeni not",
      status: "PENDING",
      description: null,
      originRefId: LINK_A,
      assignmentGroupId: GROUP,
    });
    await expect(
      service.updateMentorshipTask(
        { studentId: STUDENT_A, mentorshipLinkId: LINK_A },
        completed.id,
        { title: "Değişmemeli" },
      ),
    ).rejects.toMatchObject({ code: "MENTORSHIP_ASSIGNMENT_NOT_EDITABLE" });
    expect(rows[1]!.title).toBe("Paragraf");
  });

  it("group edit/delete stays inside authorized links and preserves completed rows", async () => {
    const pendingA = row({ id: "a" });
    const pendingB = row({ id: "b", userId: STUDENT_B, originRefId: LINK_B });
    const doneB = row({
      id: "done",
      userId: STUDENT_B,
      originRefId: LINK_B,
      status: "DONE",
    });
    const outsider = row({
      id: "outsider",
      userId: "00000000-0000-4000-8000-000000000099",
      originRefId: "00000000-0000-4000-8000-000000000098",
    });
    const { service, rows } = setup([pendingA, pendingB, doneB, outsider]);
    const scopes = [
      { studentId: STUDENT_A, mentorshipLinkId: LINK_A },
      { studentId: STUDENT_B, mentorshipLinkId: LINK_B },
    ];

    const changed = await service.updateMentorshipTaskGroup(scopes, GROUP, {
      taskDate: TODAY,
      title: "Grup başlığı",
    });
    expect(changed.map((item) => item.id).sort()).toEqual(["a", "b"]);
    expect(doneB.title).toBe("Paragraf");
    expect(outsider.title).toBe("Paragraf");

    await service.removeMentorshipTaskGroup(scopes, GROUP);
    expect(rows.map((item) => item.id).sort()).toEqual(["done", "outsider"]);
  });

  it("uses the caller transaction for batch, single, and group mentorship mutations", async () => {
    const pendingA = row({ id: "a" });
    const pendingB = row({ id: "b", userId: STUDENT_B, originRefId: LINK_B });
    const { service, tasks, db } = setup([pendingA, pendingB]);
    const tx = { execute: vi.fn() };
    const scopes = [
      { studentId: STUDENT_A, mentorshipLinkId: LINK_A },
      { studentId: STUDENT_B, mentorshipLinkId: LINK_B },
    ];

    await service.createMentorshipBatchInTransaction(
      tx as never,
      scopes,
      { title: "Yeni", taskDate: TODAY },
    );
    await service.updateMentorshipTaskInTransaction(
      tx as never,
      scopes[0]!,
      pendingA.id,
      { title: "Tekli" },
    );
    await service.updateMentorshipTaskGroupInTransaction(
      tx as never,
      scopes,
      GROUP,
      { title: "Grup" },
    );
    await service.removeMentorshipTaskInTransaction(
      tx as never,
      scopes[0]!,
      pendingA.id,
    );
    await service.removeMentorshipTaskGroupInTransaction(
      tx as never,
      scopes,
      GROUP,
    );

    expect(db.transaction).not.toHaveBeenCalled();
    expect(tasks.create).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ originRefId: LINK_A }),
    );
    expect(tasks.updatePendingMentorshipTask).toHaveBeenCalledWith(
      tx,
      scopes[0],
      pendingA.id,
      expect.any(Object),
    );
    expect(tasks.updatePendingMentorshipGroup).toHaveBeenCalledWith(
      tx,
      scopes,
      GROUP,
      expect.any(Object),
    );
    expect(tasks.deletePendingMentorshipTask).toHaveBeenCalledWith(
      tx,
      scopes[0],
      pendingA.id,
    );
    expect(tasks.deletePendingMentorshipGroup).toHaveBeenCalledWith(
      tx,
      scopes,
      GROUP,
    );
  });
});
