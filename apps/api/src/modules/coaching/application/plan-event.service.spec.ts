import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "../../../common/errors/error-code";
import { CoachingEventTopic } from "../domain/coaching.events";
import { PlanEventService } from "./plan-event.service";

const ORGANIZER = "00000000-0000-4000-8000-000000000001";
const STUDENT_A = "00000000-0000-4000-8000-000000000002";
const STUDENT_B = "00000000-0000-4000-8000-000000000003";
const NOW = new Date("2026-09-09T09:00:00.000Z");

const fakeDb = {
  transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> =>
    callback({ execute: vi.fn() }),
} as never;

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    seriesId: null,
    organizerUserId: ORGANIZER,
    orgId: null,
    title: "Haftalık görüşme",
    description: null,
    eventDate: "2026-09-10",
    startTime: "10:00:00",
    endTime: "10:30:00",
    status: "SCHEDULED",
    attendeeCount: 2,
    attendeeIds: [STUDENT_A, STUDENT_B],
    series: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeRepository(initial = [eventRow()]) {
  const rows = initial;
  const seriesRows: Array<Record<string, unknown>> = [];
  return {
    rows,
    seriesRows,
    acquireOrganizerLock: vi.fn(),
    createSeries: vi.fn(async (_tx, data) => {
      const row = {
        id: "00000000-0000-4000-8000-000000000020",
        createdAt: NOW,
        updatedAt: NOW,
        ...data,
      };
      seriesRows.push(row);
      return row;
    }),
    updateSeries: vi.fn(async (_tx, _organizerId, _seriesId, patch) => {
      Object.assign(seriesRows[0] ?? {}, patch);
    }),
    createOccurrences: vi.fn(async (_tx, values) =>
      values.map((value: Record<string, unknown>, index: number) => {
        const row = eventRow({
          id: `00000000-0000-4000-8000-${String(100 + rows.length + index).padStart(12, "0")}`,
          attendeeIds: [],
          series: seriesRows[0] ?? null,
          ...value,
        });
        rows.push(row);
        return row;
      }),
    ),
    addAttendees: vi.fn(async (_tx, values) => {
      for (const value of values as Array<{
        eventId: string;
        attendeeUserId: string;
      }>) {
        const row = rows.find((candidate) => candidate.id === value.eventId);
        if (row) row.attendeeIds.push(value.attendeeUserId);
      }
    }),
    findOwnedById: vi.fn(async (_tx, organizerId, id) =>
      rows.find(
        (row) => row.id === id && row.organizerUserId === organizerId,
      ),
    ),
    updateOccurrence: vi.fn(async (_tx, organizerId, id, patch) => {
      const row = rows.find(
        (candidate) =>
          candidate.id === id && candidate.organizerUserId === organizerId,
      );
      if (row) Object.assign(row, patch);
      return row;
    }),
    updateFutureOccurrences: vi.fn(
      async (_tx, organizerId, seriesId, from, patch) => {
        const affected = rows.filter(
          (row) =>
            row.organizerUserId === organizerId &&
            row.seriesId === seriesId &&
            row.eventDate >= from,
        );
        affected.forEach((row) => Object.assign(row, patch));
        return affected;
      },
    ),
    deleteFutureOccurrences: vi.fn(
      async (_tx, organizerId, seriesId, from) => {
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          const row = rows[index]!;
          if (
            row.organizerUserId === organizerId &&
            row.seriesId === seriesId &&
            row.eventDate >= from
          ) {
            rows.splice(index, 1);
          }
        }
      },
    ),
    replaceAttendees: vi.fn(async (_tx, organizerId, eventIds, attendeeIds) => {
      for (const row of rows) {
        if (
          row.organizerUserId === organizerId &&
          eventIds.includes(row.id)
        ) {
          row.attendeeIds = [...attendeeIds];
        }
      }
    }),
    cancelOccurrence: vi.fn(async (_tx, organizerId, id) => {
      const row = rows.find(
        (candidate) =>
          candidate.id === id && candidate.organizerUserId === organizerId,
      );
      if (row) row.status = "CANCELLED";
      return row;
    }),
    cancelFutureSeries: vi.fn(async (_tx, organizerId, seriesId, from) => {
      const affected = rows.filter(
        (row) =>
          row.organizerUserId === organizerId &&
          row.seriesId === seriesId &&
          row.eventDate >= from,
      );
      affected.forEach((row) => {
        row.status = "CANCELLED";
      });
      return affected;
    }),
    listParticipantPaged: vi.fn(async (_tx, participantId) => {
      const items = rows.filter(
        (row) =>
          row.organizerUserId === participantId ||
          row.attendeeIds.includes(participantId),
      );
      return { items, total: items.length };
    }),
    listPlanItemRefsPaged: vi.fn(),
    findParticipantByIds: vi.fn(async (_tx, participantId, ids) =>
      rows.filter(
        (row) =>
          ids.includes(row.id) &&
          (row.organizerUserId === participantId ||
            row.attendeeIds.includes(participantId)),
      ),
    ),
    listAuthorizedForCoach: vi.fn(async () => rows),
    removeFutureAttendee: vi.fn(async () => 2),
  };
}

function makeService(initial?: ReturnType<typeof eventRow>[]) {
  const repository = makeRepository(initial);
  const tasks = {
    findByIds: vi.fn(async () => []),
    listMentorshipTasksForCoach: vi.fn(async () => []),
  };
  const emitter = { emit: vi.fn() };
  return {
    repository,
    tasks,
    emitter,
    service: new PlanEventService(
      fakeDb,
      repository as never,
      tasks as never,
      emitter as never,
    ),
  };
}

describe("PlanEventService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it("creates one occurrence without a series and removes the organizer from attendees", async () => {
    const { service, repository, emitter } = makeService([]);

    const result = await service.create(ORGANIZER, {
      title: "Birebir",
      eventDate: "2026-09-10",
      attendeeIds: [ORGANIZER, STUDENT_A],
    });

    expect(repository.createSeries).not.toHaveBeenCalled();
    expect(repository.createOccurrences).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({ seriesId: null, eventDate: "2026-09-10" })],
    );
    expect(repository.addAttendees).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({ attendeeUserId: STUDENT_A })],
    );
    expect(result).toMatchObject({ attendeeCount: 1 });
    expect(result).not.toHaveProperty("attendeeIds");
    expect(emitter.emit).toHaveBeenCalledWith(
      CoachingEventTopic.PLAN_EVENT_CREATED,
      expect.objectContaining({
        organizerUserId: ORGANIZER,
        recipientUserIds: [STUDENT_A],
      }),
    );
  });

  it("materializes every bounded recurring occurrence and its attendees atomically", async () => {
    const { service, repository } = makeService([]);

    await service.create(ORGANIZER, {
      title: "Kontrol",
      eventDate: "2026-09-09",
      attendeeIds: [STUDENT_A, STUDENT_B],
      recurrence: { frequency: "WEEKLY", end: { kind: "COUNT", count: 3 } },
    });

    expect(repository.createSeries).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        startsOn: "2026-09-09",
        occurrenceCount: 3,
      }),
    );
    expect(repository.createOccurrences.mock.calls[0]?.[1]).toEqual([
      expect.objectContaining({ eventDate: "2026-09-09" }),
      expect.objectContaining({ eventDate: "2026-09-16" }),
      expect.objectContaining({ eventDate: "2026-09-23" }),
    ]);
    expect(repository.addAttendees.mock.calls[0]?.[1]).toHaveLength(6);
  });

  it("projects participant reads without exposing attendee user IDs", async () => {
    const { service } = makeService();

    const page = await service.list(STUDENT_A, {
      date: "2026-09-10",
      page: 1,
      pageSize: 20,
    });

    expect(page.items[0]).toMatchObject({
      organizerUserId: ORGANIZER,
      attendeeCount: 2,
    });
    expect(page.items[0]).not.toHaveProperty("attendeeIds");
  });

  it("updates only one future occurrence and replaces its attendees", async () => {
    const { service, repository } = makeService();
    const id = repository.rows[0]!.id;

    await service.update(ORGANIZER, id, {
      scope: "OCCURRENCE",
      title: "Yeni başlık",
      attendeeIds: [STUDENT_A],
    });

    expect(repository.updateOccurrence).toHaveBeenCalledWith(
      expect.anything(),
      ORGANIZER,
      id,
      expect.objectContaining({ title: "Yeni başlık" }),
    );
    expect(repository.updateFutureOccurrences).not.toHaveBeenCalled();
    expect(repository.replaceAttendees).toHaveBeenCalledWith(
      expect.anything(),
      ORGANIZER,
      [id],
      [STUDENT_A],
    );
  });

  it("updates only today and future rows for SERIES without rewriting history", async () => {
    const past = eventRow({
      id: "00000000-0000-4000-8000-000000000011",
      seriesId: "00000000-0000-4000-8000-000000000020",
      eventDate: "2026-09-08",
    });
    const future = eventRow({
      seriesId: "00000000-0000-4000-8000-000000000020",
      series: {
        id: "00000000-0000-4000-8000-000000000020",
        frequency: "WEEKLY",
        startsOn: "2026-09-01",
        endsOn: null,
        occurrenceCount: 10,
      },
    });
    const { service, repository } = makeService([past, future]);

    await service.update(ORGANIZER, future.id, {
      scope: "SERIES",
      title: "Güncel görüşme",
    });

    expect(repository.updateFutureOccurrences).toHaveBeenCalledWith(
      expect.anything(),
      ORGANIZER,
      future.seriesId,
      "2026-09-09",
      expect.objectContaining({ title: "Güncel görüşme" }),
    );
    expect(past.title).toBe("Haftalık görüşme");
  });

  it("regenerates future SERIES rows when recurrence changes and preserves past rows", async () => {
    const seriesId = "00000000-0000-4000-8000-000000000020";
    const past = eventRow({
      id: "00000000-0000-4000-8000-000000000011",
      seriesId,
      eventDate: "2026-09-08",
    });
    const selected = eventRow({
      seriesId,
      eventDate: "2026-09-10",
      series: {
        id: seriesId,
        frequency: "WEEKLY",
        startsOn: "2026-09-03",
        endsOn: null,
        occurrenceCount: 5,
      },
    });
    const { service, repository } = makeService([past, selected]);

    await service.update(ORGANIZER, selected.id, {
      scope: "SERIES",
      recurrence: {
        frequency: "DAILY",
        end: { kind: "DATE", date: "2026-09-12" },
      },
    });

    expect(repository.deleteFutureOccurrences).toHaveBeenCalledWith(
      expect.anything(),
      ORGANIZER,
      seriesId,
      "2026-09-09",
    );
    expect(repository.createOccurrences.mock.calls.at(-1)?.[1]).toEqual([
      expect.objectContaining({ eventDate: "2026-09-10" }),
      expect.objectContaining({ eventDate: "2026-09-11" }),
      expect.objectContaining({ eventDate: "2026-09-12" }),
    ]);
    expect(repository.rows).toContain(past);
  });

  it("checks a partial DATE recurrence update against the stored event date", async () => {
    const seriesId = "00000000-0000-4000-8000-000000000020";
    const selected = eventRow({
      eventDate: "2026-09-11",
      seriesId,
      series: {
        id: seriesId,
        frequency: "WEEKLY",
        startsOn: "2026-09-04",
        endsOn: null,
        occurrenceCount: 4,
      },
    });
    const { service } = makeService([selected]);

    await expect(
      service.update(ORGANIZER, selected.id, {
        scope: "SERIES",
        recurrence: {
          frequency: "DAILY",
          end: { kind: "DATE", date: "2026-09-10" },
        },
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.COACHING_EVENT_RECURRENCE_INVALID,
    });
  });

  it("cancels one future occurrence but rejects a past occurrence", async () => {
    const future = eventRow();
    const past = eventRow({
      id: "00000000-0000-4000-8000-000000000012",
      eventDate: "2026-09-08",
    });
    const { service, repository } = makeService([future, past]);

    await service.cancel(ORGANIZER, future.id, { scope: "OCCURRENCE" });
    expect(repository.cancelOccurrence).toHaveBeenCalledWith(
      expect.anything(),
      ORGANIZER,
      future.id,
    );
    await expect(
      service.cancel(ORGANIZER, past.id, { scope: "OCCURRENCE" }),
    ).rejects.toMatchObject({
      code: ErrorCode.COACHING_EVENT_DATE_READONLY,
    });
  });

  it("cancels only today and future occurrences for SERIES", async () => {
    const seriesId = "00000000-0000-4000-8000-000000000020";
    const selected = eventRow({
      seriesId,
      attendeeCount: 1,
      attendeeIds: [STUDENT_A],
    });
    const later = eventRow({
      id: "00000000-0000-4000-8000-000000000013",
      seriesId,
      eventDate: "2026-09-17",
      attendeeCount: 1,
      attendeeIds: [STUDENT_B],
    });
    const { service, repository, emitter } = makeService([selected, later]);

    await service.cancel(ORGANIZER, selected.id, { scope: "SERIES" });

    expect(repository.cancelFutureSeries).toHaveBeenCalledWith(
      expect.anything(),
      ORGANIZER,
      seriesId,
      "2026-09-09",
    );
    expect(emitter.emit).toHaveBeenCalledWith(
      CoachingEventTopic.PLAN_EVENT_CANCELLED,
      expect.objectContaining({
        recipientUserIds: [STUDENT_A, STUDENT_B],
      }),
    );
  });

  it("returns stable errors for stale IDs and invalid SERIES scope", async () => {
    const oneOff = eventRow();
    const { service } = makeService([oneOff]);

    await expect(
      service.update(ORGANIZER, "missing", {
        scope: "OCCURRENCE",
        title: "Yok",
      }),
    ).rejects.toMatchObject({ code: ErrorCode.COACHING_EVENT_NOT_FOUND });
    await expect(
      service.cancel(ORGANIZER, oneOff.id, { scope: "SERIES" }),
    ).rejects.toMatchObject({
      code: ErrorCode.COACHING_EVENT_SCOPE_INVALID,
    });
  });

  it("uses explicit organizer/student filters for coach reads and link-end cleanup", async () => {
    const { service, repository } = makeService();
    const scopes = [
      {
        mentorshipLinkId: "00000000-0000-4000-8000-000000000099",
        studentId: STUDENT_A,
      },
    ];

    await service.listAuthorizedForCoach(ORGANIZER, scopes, {
      from: "2026-09-09",
      to: "2026-09-30",
    });
    await service.removeFutureAttendee(ORGANIZER, STUDENT_A);

    expect(repository.listAuthorizedForCoach).toHaveBeenCalledWith(
      expect.anything(),
      ORGANIZER,
      [STUDENT_A],
      "2026-09-09",
      "2026-09-30",
    );
    expect(repository.removeFutureAttendee).toHaveBeenCalledWith(
      expect.anything(),
      ORGANIZER,
      STUDENT_A,
      "2026-09-09",
    );
  });
});
