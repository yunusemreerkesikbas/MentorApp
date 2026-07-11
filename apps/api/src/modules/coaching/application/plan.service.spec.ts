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
    listByDateRangePaged: async (
      _tx: unknown,
      userId: string,
      from: string,
      to: string,
    ) => {
      const items = rows
        .filter((r) => r.userId === userId && r.taskDate >= from && r.taskDate <= to)
        .sort(
          (a, b) =>
            a.taskDate.localeCompare(b.taskDate) ||
            a.sortOrder - b.sortOrder ||
            a.createdAt.getTime() - b.createdAt.getTime(),
        );
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
    countTotal: async (_tx: unknown, userId: string, date: string) =>
      rows.filter((r) => r.userId === userId && r.taskDate === date).length,
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
    service = new PlanService(fakeDb, planRepo as never, activity as never, { emit: () => {} } as never);
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

  it("lists tasks in an inclusive date range", async () => {
    planRepo.rows.push(
      {
        id: "t1",
        userId: USER,
        taskDate: "2025-06-23",
        title: "Mon",
        subject: null,
        status: "PENDING",
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "t2",
        userId: USER,
        taskDate: "2025-06-25",
        title: "Wed",
        subject: null,
        status: "DONE",
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "t3",
        userId: USER,
        taskDate: "2025-06-30",
        title: "Out of range",
        subject: null,
        status: "PENDING",
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    const result = await service.list(USER, {
      from: "2025-06-23",
      to: "2025-06-29",
      page: 1,
      pageSize: 50,
    });

    expect(result.items).toHaveLength(2);
    expect(result.items.map((t) => t.taskDate)).toEqual(["2025-06-23", "2025-06-25"]);
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

describe("PlanService.getTodaySummary", () => {
  let planRepo: ReturnType<typeof makePlanRepoFake>;
  let service: PlanService;

  beforeEach(() => {
    planRepo = makePlanRepoFake([]);
    service = new PlanService(fakeDb, planRepo as never, makeActivityFake() as never, {
      emit: () => {},
    } as never);
  });

  it("returns null when there are no tasks today", async () => {
    expect(await service.getTodaySummary(USER)).toBeNull();
  });

  it("returns counts and capped pending titles", async () => {
    for (let i = 1; i <= 6; i++) {
      planRepo.rows.push({
        id: `t${i}`,
        userId: USER,
        taskDate: TODAY,
        title: `Task ${i}`,
        subject: null,
        status: i <= 2 ? "DONE" : "PENDING",
        sortOrder: i,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const summary = await service.getTodaySummary(USER);
    expect(summary).toEqual({
      total: 6,
      done: 2,
      pendingTitles: ["Task 3", "Task 4", "Task 5", "Task 6"],
    });
  });

  it("caps pending titles at TODAY_PLAN_PENDING_MAX", async () => {
    for (let i = 1; i <= 7; i++) {
      planRepo.rows.push({
        id: `t${i}`,
        userId: USER,
        taskDate: TODAY,
        title: `Task ${i}`,
        subject: null,
        status: "PENDING",
        sortOrder: i,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const summary = await service.getTodaySummary(USER);
    expect(summary?.pendingTitles).toHaveLength(5);
    expect(summary?.pendingTitles).toEqual(["Task 1", "Task 2", "Task 3", "Task 4", "Task 5"]);
  });
});
