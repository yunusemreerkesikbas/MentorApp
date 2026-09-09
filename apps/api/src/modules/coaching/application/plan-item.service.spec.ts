import { expect, it, vi } from "vitest";
import { PlanItemService } from "./plan-item.service";

const USER = "00000000-0000-4000-8000-000000000001";
const fakeDb = {
  transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> =>
    callback({ execute: vi.fn() }),
} as never;

it("returns a single ordered page of own tasks and participant-safe events", async () => {
  const items = {
    listPaged: vi.fn(async () => ({
      refs: [
        { kind: "TASK" as const, id: "task-1" },
        { kind: "EVENT" as const, id: "event-1" },
      ],
      total: 2,
    })),
  };
  const tasks = {
    findByIds: vi.fn(async () => [
      {
        id: "task-1",
        userId: USER,
        title: "All-day task",
        subject: null,
        topic: null,
        status: "PENDING",
        sortOrder: 0,
        taskDate: "2026-09-09",
        startTime: null,
        endTime: null,
        description: null,
        coachNote: null,
        originType: null,
        originRefId: null,
        originMeta: null,
        assignmentGroupId: null,
      },
    ]),
  };
  const events = {
    findParticipantByIds: vi.fn(async () => [
      {
        id: "event-1",
        seriesId: null,
        organizerUserId: USER,
        orgId: null,
        title: "Timed event",
        description: null,
        eventDate: "2026-09-09",
        startTime: "10:00:00",
        endTime: null,
        status: "SCHEDULED",
        attendeeCount: 2,
        attendeeIds: ["student-a", "student-b"],
        series: null,
        createdAt: new Date("2026-09-09T08:00:00Z"),
        updatedAt: new Date("2026-09-09T08:00:00Z"),
      },
    ]),
  };
  const service = new PlanItemService(
    fakeDb,
    items as never,
    tasks as never,
    events as never,
  );

  const result = await service.list(USER, {
    date: "2026-09-09",
    page: 1,
    pageSize: 20,
  });

  expect(result.items).toEqual([
    expect.objectContaining({ kind: "TASK" }),
    expect.objectContaining({
      kind: "EVENT",
      event: expect.objectContaining({ attendeeCount: 2 }),
    }),
  ]);
  expect(result.items[1]).not.toHaveProperty("event.attendeeIds");
  expect(result).toMatchObject({ total: 2, page: 1, pageSize: 20 });
});
