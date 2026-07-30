import { beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "../../../common/errors/domain-error";
import { addDays } from "../domain/date.util";
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
  /** Absent on most fixtures — an all-day task, which is what every pre-calendar row is. */
  startTime?: string | null;
  endTime?: string | null;
  description?: string | null;
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
    acquireUserLock: async () => undefined,
    listByDate: async (_tx: unknown, userId: string, date: string) =>
      rows.filter((r) => r.userId === userId && r.taskDate === date),
    listByDateRange: async (_tx: unknown, userId: string, from: string, to: string) =>
      rows
        .filter((r) => r.userId === userId && r.taskDate >= from && r.taskDate <= to)
        .sort((a, b) => a.taskDate.localeCompare(b.taskDate) || a.sortOrder - b.sortOrder),
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
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        description: data.description ?? null,
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

  it("keeps a task all-day when no time is given", async () => {
    const created = await service.create(USER, { title: "Tekrar" });
    expect(created).toMatchObject({ startTime: null, endTime: null, description: null });
  });

  it("persists calendar times and description, and can clear them back to all-day", async () => {
    const created = await service.create(USER, {
      title: "Matematik tekrar",
      startTime: "13:00",
      endTime: "14:30",
      description: "Problemler + hız",
    });
    expect(created).toMatchObject({
      startTime: "13:00",
      endTime: "14:30",
      description: "Problemler + hız",
    });

    const cleared = await service.update(USER, created.id, {
      startTime: null,
      endTime: null,
    });
    expect(cleared).toMatchObject({ startTime: null, endTime: null });
    // Clearing the times must not wipe the note.
    expect(cleared.description).toBe("Problemler + hız");
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

describe("PlanService.createMany", () => {
  let planRepo: ReturnType<typeof makePlanRepoFake>;
  let service: PlanService;

  beforeEach(() => {
    planRepo = makePlanRepoFake([]);
    service = new PlanService(fakeDb, planRepo as never, makeActivityFake() as never, {
      emit: () => {},
    } as never);
  });

  it("creates every task in one pass (dates default to today)", async () => {
    const out = await service.createMany(USER, [
      { title: "Matematik: 20 soru", subject: "Matematik" },
      { title: "Paragraf: 15 soru", subject: "Türkçe", taskDate: TODAY },
    ]);
    expect(out).toHaveLength(2);
    expect(planRepo.rows).toHaveLength(2);
    expect(planRepo.rows.every((r) => r.taskDate === TODAY)).toBe(true);
  });

  it("writes NOTHING when any date is in the past (all-or-nothing)", async () => {
    await expect(
      service.createMany(USER, [
        { title: "Geçerli", taskDate: TODAY },
        { title: "Geçmiş", taskDate: "2020-01-01" },
      ]),
    ).rejects.toBeInstanceOf(DomainError);
    expect(planRepo.rows).toHaveLength(0);
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

describe("PlanService plan adaptations", () => {
  let planRepo: ReturnType<typeof makePlanRepoFake>;
  let service: PlanService;

  beforeEach(() => {
    planRepo = makePlanRepoFake([
      {
        id: "t1",
        userId: USER,
        taskDate: TODAY,
        title: "Paragraf",
        subject: "Türkçe",
        status: "PENDING",
        sortOrder: 0,
        createdAt: new Date("2026-07-21T09:00:00Z"),
        updatedAt: new Date("2026-07-21T09:00:00Z"),
      },
      {
        id: "t2",
        userId: USER,
        taskDate: addDays(TODAY, 1),
        title: "Matematik",
        subject: "Matematik",
        status: "PENDING",
        sortOrder: 5,
        createdAt: new Date("2026-07-21T09:00:00Z"),
        updatedAt: new Date("2026-07-21T09:00:00Z"),
      },
    ]);
    service = new PlanService(fakeDb, planRepo as never, makeActivityFake() as never, {
      emit: () => {},
    } as never);
  });

  it("returns a seven-day snapshot with a stable revision", async () => {
    const snapshot = await service.getAdaptationSnapshot(USER);
    expect(snapshot.window).toEqual({ from: TODAY, to: addDays(TODAY, 6) });
    expect(snapshot.tasks.map((task) => task.id)).toEqual(["t1", "t2"]);
    expect(snapshot.planRevision).toMatch(/^[a-f0-9]{64}$/);
  });

  it("atomically moves pending tasks and adds selected tasks", async () => {
    const snapshot = await service.getAdaptationSnapshot(USER);
    const result = await service.applyAdaptation(USER, {
      planRevision: snapshot.planRevision,
      changes: [
        {
          kind: "MOVE",
          taskId: "t1",
          title: "ignored display copy",
          subject: null,
          fromDate: TODAY,
          toDate: addDays(TODAY, 1),
        },
        {
          kind: "ADD",
          title: "Tarih tekrar",
          subject: "Tarih",
          taskDate: addDays(TODAY, 2),
        },
      ],
    });

    expect(result.moved).toMatchObject([
      { id: "t1", taskDate: addDays(TODAY, 1), sortOrder: 6, title: "Paragraf" },
    ]);
    expect(result.added).toMatchObject([
      { taskDate: addDays(TODAY, 2), sortOrder: 0, title: "Tarih tekrar" },
    ]);
  });

  it("validates target capacity from the final selected move set", async () => {
    const targetDate = addDays(TODAY, 1);
    const sourceDate = addDays(TODAY, 2);
    const finalDate = addDays(TODAY, 3);
    planRepo.rows.push(
      {
        id: "t3",
        userId: USER,
        taskDate: targetDate,
        title: "Geometri",
        subject: "Matematik",
        status: "PENDING",
        sortOrder: 6,
        createdAt: new Date("2026-07-21T09:00:00Z"),
        updatedAt: new Date("2026-07-21T09:00:00Z"),
      },
      {
        id: "t4",
        userId: USER,
        taskDate: targetDate,
        title: "Problemler",
        subject: "Matematik",
        status: "PENDING",
        sortOrder: 7,
        createdAt: new Date("2026-07-21T09:00:00Z"),
        updatedAt: new Date("2026-07-21T09:00:00Z"),
      },
      {
        id: "t5",
        userId: USER,
        taskDate: sourceDate,
        title: "Vatandaşlık",
        subject: "Vatandaşlık",
        status: "PENDING",
        sortOrder: 0,
        createdAt: new Date("2026-07-21T09:00:00Z"),
        updatedAt: new Date("2026-07-21T09:00:00Z"),
      },
    );
    const snapshot = await service.getAdaptationSnapshot(USER);

    const result = await service.applyAdaptation(USER, {
      planRevision: snapshot.planRevision,
      changes: [
        {
          kind: "MOVE",
          taskId: "t5",
          title: "Vatandaşlık",
          subject: "Vatandaşlık",
          fromDate: sourceDate,
          toDate: targetDate,
        },
        {
          kind: "MOVE",
          taskId: "t2",
          title: "Matematik",
          subject: "Matematik",
          fromDate: targetDate,
          toDate: finalDate,
        },
      ],
    });

    expect(result.moved).toMatchObject([
      { id: "t5", taskDate: targetDate, sortOrder: 8 },
      { id: "t2", taskDate: finalDate, sortOrder: 0 },
    ]);
  });

  it("rejects a move that duplicates a normalized title on the target day", async () => {
    const targetDate = addDays(TODAY, 1);
    planRepo.rows.push({
      id: "t3",
      userId: USER,
      taskDate: TODAY,
      title: "  matematik  ",
      subject: "Matematik",
      status: "PENDING",
      sortOrder: 1,
      createdAt: new Date("2026-07-21T09:00:00Z"),
      updatedAt: new Date("2026-07-21T09:00:00Z"),
    });
    const snapshot = await service.getAdaptationSnapshot(USER);

    await expect(
      service.applyAdaptation(USER, {
        planRevision: snapshot.planRevision,
        changes: [
          {
            kind: "MOVE",
            taskId: "t3",
            title: "matematik",
            subject: "Matematik",
            fromDate: TODAY,
            toDate: targetDate,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "COACHING_PLAN_CHANGED" });
    expect(planRepo.rows.find((row) => row.id === "t3")!.taskDate).toBe(TODAY);
  });

  it("rejects a stale revision without changing the plan", async () => {
    const snapshot = await service.getAdaptationSnapshot(USER);
    planRepo.rows[0]!.title = "Changed elsewhere";

    await expect(
      service.applyAdaptation(USER, {
        planRevision: snapshot.planRevision,
        changes: [
          {
            kind: "MOVE",
            taskId: "t1",
            title: "Paragraf",
            subject: "Türkçe",
            fromDate: TODAY,
            toDate: addDays(TODAY, 1),
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "COACHING_PLAN_CHANGED" });
    expect(planRepo.rows[0]!.taskDate).toBe(TODAY);
  });
});
