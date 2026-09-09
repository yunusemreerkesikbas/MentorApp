import { vi } from "vitest";
import { PlanEventService } from "./plan-event.service";

export const ORGANIZER = "00000000-0000-4000-8000-000000000001";
export const STUDENT_A = "00000000-0000-4000-8000-000000000002";
export const STUDENT_B = "00000000-0000-4000-8000-000000000003";
export const NOW = new Date("2026-09-09T09:00:00.000Z");

const fakeDb = {
  transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> =>
    callback({ execute: vi.fn() }),
} as never;

export function eventRow(overrides: Record<string, unknown> = {}) {
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
    findOwnedByIds: vi.fn(async (_tx, organizerId, ids) =>
      rows.filter(
        (row) => ids.includes(row.id) && row.organizerUserId === organizerId,
      ),
    ),
    listFutureSeries: vi.fn(async (_tx, organizerId, seriesId, from) =>
      rows
        .filter(
          (row) =>
            row.organizerUserId === organizerId &&
            row.seriesId === seriesId &&
            row.eventDate >= from,
        )
        .sort((left, right) => left.eventDate.localeCompare(right.eventDate)),
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
          row.attendeeCount = attendeeIds.length;
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
    findParticipantByIds: vi.fn(async (_tx, participantId, ids) =>
      rows.filter(
        (row) =>
          ids.includes(row.id) &&
          (row.organizerUserId === participantId ||
            row.attendeeIds.includes(participantId)),
      ),
    ),
    listAuthorizedForCoach: vi.fn(async () => rows),
    listOwnedForCoach: vi.fn(async () => rows),
    removeFutureAttendee: vi.fn(async () => 2),
  };
}

export function makeService(initial?: ReturnType<typeof eventRow>[]) {
  const repository = makeRepository(initial);
  const tasks = {
    findByIds: vi.fn(async () => []),
    listMentorshipTasksForCoach: vi.fn(async () => []),
    listOwnedForCoach: vi.fn(async () => []),
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
