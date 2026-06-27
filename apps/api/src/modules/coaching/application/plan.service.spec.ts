import { beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "../../../common/errors/domain-error";
import { PlanService } from "./plan.service";

const USER = "u1";
const TODAY = new Date().toISOString().slice(0, 10);

interface TaskRow {
  id: string;
  userId: string;
  taskDate: string;
  title: string;
  subject: string | null;
  status: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Fake db whose transaction just yields a no-op tx (RLS set_config is a no-op here). */
const fakeDb = {
  transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> =>
    cb({ execute: async () => undefined }),
} as never;

function makePlanRepoFake(rows: TaskRow[]) {
  return {
    rows,
    listByDate: async (_tx: unknown, userId: string, date: string) =>
      rows.filter((r) => r.userId === userId && r.taskDate === date),
    listByDatePaged: async (_tx: unknown, userId: string, date: string) => {
      const items = rows.filter((r) => r.userId === userId && r.taskDate === date);
      return { items, total: items.length };
    },
    findById: async (_tx: unknown, userId: string, id: string) =>
      rows.find((r) => r.id === id && r.userId === userId),
    create: async (_tx: unknown, data: Partial<TaskRow>) => {
      const row: TaskRow = {
        id: `t${rows.length + 1}`,
        userId: data.userId!,
        taskDate: data.taskDate!,
        title: data.title!,
        subject: data.subject ?? null,
        status: data.status ?? "PENDING",
        sortOrder: data.sortOrder ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      rows.push(row);
      return row;
    },
    update: async (_tx: unknown, userId: string, id: string, patch: Partial<TaskRow>) => {
      const row = rows.find((r) => r.id === id && r.userId === userId);
      if (row) Object.assign(row, patch);
      return row;
    },
    delete: async (_tx: unknown, userId: string, id: string) => {
      const idx = rows.findIndex((r) => r.id === id && r.userId === userId);
      if (idx >= 0) rows.splice(idx, 1);
      return idx >= 0;
    },
    countDone: async (_tx: unknown, userId: string, date: string) =>
      rows.filter((r) => r.userId === userId && r.taskDate === date && r.status === "DONE").length,
  };
}

function makeActivityFake() {
  const days = new Map<string, { tasksDone: number; hasSession: boolean }>();
  return {
    days,
    upsertTasksDone: async (_tx: unknown, _userId: string, date: string, tasksDone: number) => {
      const cur = days.get(date) ?? { tasksDone: 0, hasSession: false };
      days.set(date, { ...cur, tasksDone });
    },
    upsertHasSession: async (_tx: unknown, _userId: string, date: string, hasSession: boolean) => {
      const cur = days.get(date) ?? { tasksDone: 0, hasSession: false };
      days.set(date, { ...cur, hasSession });
    },
  };
}

describe("PlanService — task toggle keeps daily_activity in sync", () => {
  let planRepo: ReturnType<typeof makePlanRepoFake>;
  let activity: ReturnType<typeof makeActivityFake>;
  let service: PlanService;

  beforeEach(() => {
    planRepo = makePlanRepoFake([]);
    activity = makeActivityFake();
    service = new PlanService(fakeDb, planRepo as never, activity as never);
  });

  it("marking a task DONE bumps daily_activity.tasks_done", async () => {
    const created = await service.create(USER, { title: "Paragraf 20 soru" });
    await service.update(USER, created.id, { status: "DONE" });
    expect(activity.days.get(TODAY)?.tasksDone).toBe(1);
  });

  it("toggling a task back to PENDING decrements the day's count", async () => {
    const created = await service.create(USER, { title: "Matematik tekrar" });
    await service.update(USER, created.id, { status: "DONE" });
    await service.update(USER, created.id, { status: "PENDING" });
    expect(activity.days.get(TODAY)?.tasksDone).toBe(0);
  });

  it("editing only the title does NOT touch daily_activity", async () => {
    const created = await service.create(USER, { title: "Tarih notları" });
    await service.update(USER, created.id, { title: "Tarih — İnkılap notları" });
    expect(activity.days.has(TODAY)).toBe(false);
  });

  it("deleting a DONE task recomputes the day's count", async () => {
    const a = await service.create(USER, { title: "A" });
    const b = await service.create(USER, { title: "B" });
    await service.update(USER, a.id, { status: "DONE" });
    await service.update(USER, b.id, { status: "DONE" });
    expect(activity.days.get(TODAY)?.tasksDone).toBe(2);
    await service.remove(USER, a.id);
    expect(activity.days.get(TODAY)?.tasksDone).toBe(1);
  });

  it("updating a missing task throws COACHING_TASK_NOT_FOUND", async () => {
    await expect(
      service.update(USER, "missing", { status: "DONE" }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("rejects create/update/delete on past task dates", async () => {
    const past = "2020-01-01";
    await expect(
      service.create(USER, { title: "Old task", taskDate: past }),
    ).rejects.toMatchObject({ code: "COACHING_TASK_DATE_READONLY" });

    const created = await service.create(USER, { title: "Today task" });
    planRepo.rows[0]!.taskDate = past;

    await expect(service.update(USER, created.id, { status: "DONE" })).rejects.toMatchObject({
      code: "COACHING_TASK_DATE_READONLY",
    });
    await expect(service.remove(USER, created.id)).rejects.toMatchObject({
      code: "COACHING_TASK_DATE_READONLY",
    });
  });
});
