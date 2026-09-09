import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "../../../common/errors/error-code";
import { CoachingEventTopic } from "../domain/coaching.events";
import {
  eventRow,
  makeService,
  NOW,
  ORGANIZER,
  STUDENT_A,
  STUDENT_B,
} from "./plan-event.service.fixture";

describe("PlanEventService mutation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it("updates only one future occurrence and replaces its attendees", async () => {
    const { service, repository, emitter } = makeService();
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
    expect(emitter.emit).toHaveBeenCalledWith(
      "coaching.plan-event.updated",
      expect.objectContaining({
        occurrences: [
          expect.objectContaining({
            eventId: id,
            title: "Yeni başlık",
            recipientUserIds: [STUDENT_A],
          }),
        ],
      }),
    );
  });

  it("updates only Istanbul today and future rows without rewriting history", async () => {
    vi.setSystemTime(new Date("2026-09-08T21:30:00.000Z"));
    const seriesId = "00000000-0000-4000-8000-000000000020";
    const past = eventRow({
      id: "00000000-0000-4000-8000-000000000011",
      seriesId,
      eventDate: "2026-09-08",
    });
    const future = eventRow({
      seriesId,
      series: {
        id: seriesId,
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
      seriesId,
      "2026-09-09",
      expect.objectContaining({ title: "Güncel görüşme" }),
    );
    expect(past.title).toBe("Haftalık görüşme");
  });

  it("does not update cancelled exceptions during a title-only series edit", async () => {
    const seriesId = "00000000-0000-4000-8000-000000000020";
    const series = {
      id: seriesId,
      frequency: "WEEKLY",
      startsOn: "2026-09-10",
      endsOn: null,
      occurrenceCount: 3,
    };
    const scheduled = eventRow({ seriesId, series });
    const cancelled = eventRow({
      id: "00000000-0000-4000-8000-000000000012",
      seriesId,
      series,
      eventDate: "2026-09-17",
      status: "CANCELLED",
    });
    const { service, repository } = makeService([scheduled, cancelled]);

    await service.update(ORGANIZER, scheduled.id, {
      scope: "SERIES",
      title: "Yeni seri",
    });

    expect(scheduled.title).toBe("Yeni seri");
    expect(cancelled.title).toBe("Haftalık görüşme");
    expect(repository.createOccurrences).not.toHaveBeenCalled();
  });

  it("replaces attendees only on future scheduled series occurrences", async () => {
    const seriesId = "00000000-0000-4000-8000-000000000020";
    const series = {
      id: seriesId,
      frequency: "WEEKLY",
      startsOn: "2026-09-10",
      endsOn: null,
      occurrenceCount: 3,
    };
    const scheduled = eventRow({ seriesId, series, attendeeIds: [STUDENT_A] });
    const cancelled = eventRow({
      id: "00000000-0000-4000-8000-000000000012",
      seriesId,
      series,
      eventDate: "2026-09-17",
      status: "CANCELLED",
      attendeeIds: [STUDENT_A],
    });
    const { service, repository } = makeService([scheduled, cancelled]);

    await service.update(ORGANIZER, scheduled.id, {
      scope: "SERIES",
      attendeeIds: [STUDENT_B],
    });

    expect(repository.replaceAttendees).toHaveBeenCalledWith(
      expect.anything(),
      ORGANIZER,
      [scheduled.id],
      [STUDENT_B],
    );
    expect(scheduled.attendeeIds).toEqual([STUDENT_B]);
    expect(cancelled.attendeeIds).toEqual([STUDENT_A]);
  });

  it("preserves a cancelled date exception and attendees by date during regeneration", async () => {
    const seriesId = "00000000-0000-4000-8000-000000000020";
    const series = {
      id: seriesId,
      frequency: "WEEKLY",
      startsOn: "2026-09-10",
      endsOn: null,
      occurrenceCount: 3,
    };
    const first = eventRow({
      seriesId,
      series,
      attendeeCount: 1,
      attendeeIds: [STUDENT_A],
    });
    const cancelled = eventRow({
      id: "00000000-0000-4000-8000-000000000012",
      seriesId,
      series,
      eventDate: "2026-09-17",
      status: "CANCELLED",
      attendeeCount: 1,
      attendeeIds: [STUDENT_B],
    });
    const third = eventRow({
      id: "00000000-0000-4000-8000-000000000013",
      seriesId,
      series,
      eventDate: "2026-09-24",
      attendeeCount: 1,
      attendeeIds: [STUDENT_B],
    });
    const { service, repository } = makeService([first, cancelled, third]);

    await service.update(ORGANIZER, first.id, {
      scope: "SERIES",
      recurrence: { frequency: "WEEKLY", end: { kind: "COUNT", count: 4 } },
    });

    expect(repository.rows.filter((row) => row.eventDate === "2026-09-17"))
      .toEqual([cancelled]);
    expect(cancelled.status).toBe("CANCELLED");
    expect(repository.rows.find((row) => row.eventDate === "2026-09-24")?.attendeeIds)
      .toEqual([STUDENT_B]);
  });

  it("rejects direct updates to a cancelled occurrence", async () => {
    const cancelled = eventRow({ status: "CANCELLED" });
    const { service, repository } = makeService([cancelled]);

    await expect(service.update(ORGANIZER, cancelled.id, {
      scope: "OCCURRENCE",
      title: "Yeniden açma",
    })).rejects.toMatchObject({
      code: ErrorCode.COACHING_EVENT_CANCELLED_READONLY,
    });
    expect(repository.updateOccurrence).not.toHaveBeenCalled();
  });

  it("rejects a past series update without touching future rows or publishing", async () => {
    const seriesId = "00000000-0000-4000-8000-000000000020";
    const series = {
      id: seriesId,
      frequency: "WEEKLY",
      startsOn: "2026-09-01",
      endsOn: null,
      occurrenceCount: 4,
    };
    const selected = eventRow({ seriesId, series, eventDate: "2026-09-08" });
    const future = eventRow({
      id: "00000000-0000-4000-8000-000000000012",
      seriesId,
      series,
      eventDate: "2026-09-15",
    });
    const { service, repository, emitter } = makeService([selected, future]);

    await expect(service.update(ORGANIZER, selected.id, {
      scope: "SERIES",
      title: "Geçmişten değişiklik",
    })).rejects.toMatchObject({
      code: ErrorCode.COACHING_EVENT_DATE_READONLY,
    });
    expect(repository.updateFutureOccurrences).not.toHaveBeenCalled();
    expect(repository.updateSeries).not.toHaveBeenCalled();
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("rejects a past series cancel without touching future rows or publishing", async () => {
    const seriesId = "00000000-0000-4000-8000-000000000020";
    const series = {
      id: seriesId,
      frequency: "WEEKLY",
      startsOn: "2026-09-01",
      endsOn: null,
      occurrenceCount: 4,
    };
    const selected = eventRow({ seriesId, series, eventDate: "2026-09-08" });
    const future = eventRow({
      id: "00000000-0000-4000-8000-000000000012",
      seriesId,
      series,
      eventDate: "2026-09-15",
    });
    const { service, repository, emitter } = makeService([selected, future]);

    await expect(
      service.cancel(ORGANIZER, selected.id, { scope: "SERIES" }),
    ).rejects.toMatchObject({
      code: ErrorCode.COACHING_EVENT_DATE_READONLY,
    });
    expect(repository.cancelFutureSeries).not.toHaveBeenCalled();
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("rejects a cancelled occurrence cancel without writing or publishing", async () => {
    const selected = eventRow({ status: "CANCELLED" });
    const { service, repository, emitter } = makeService([selected]);

    await expect(
      service.cancel(ORGANIZER, selected.id, { scope: "OCCURRENCE" }),
    ).rejects.toMatchObject({
      code: ErrorCode.COACHING_EVENT_CANCELLED_READONLY,
    });
    expect(repository.cancelOccurrence).not.toHaveBeenCalled();
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("rejects a cancelled series member cancel without touching future rows or publishing", async () => {
    const seriesId = "00000000-0000-4000-8000-000000000020";
    const series = {
      id: seriesId,
      frequency: "WEEKLY",
      startsOn: "2026-09-01",
      endsOn: null,
      occurrenceCount: 4,
    };
    const selected = eventRow({ seriesId, series, status: "CANCELLED" });
    const future = eventRow({
      id: "00000000-0000-4000-8000-000000000012",
      seriesId,
      series,
      eventDate: "2026-09-15",
    });
    const { service, repository, emitter } = makeService([selected, future]);

    await expect(
      service.cancel(ORGANIZER, selected.id, { scope: "SERIES" }),
    ).rejects.toMatchObject({
      code: ErrorCode.COACHING_EVENT_CANCELLED_READONLY,
    });
    expect(repository.cancelFutureSeries).not.toHaveBeenCalled();
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("keeps the original monthly anchor when regenerating through a clamped occurrence", async () => {
    vi.setSystemTime(new Date("2025-02-28T12:00:00.000Z"));
    const seriesId = "00000000-0000-4000-8000-000000000020";
    const series = {
      id: seriesId,
      organizerUserId: ORGANIZER,
      orgId: null,
      frequency: "MONTHLY",
      timeZone: "Europe/Istanbul",
      startsOn: "2025-01-31",
      endsOn: null,
      occurrenceCount: 4,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const past = eventRow({
      id: "00000000-0000-4000-8000-000000000011",
      seriesId,
      eventDate: "2025-01-31",
      series,
    });
    const selected = eventRow({
      seriesId,
      eventDate: "2025-02-28",
      series,
    });
    const march = eventRow({
      id: "00000000-0000-4000-8000-000000000012",
      seriesId,
      eventDate: "2025-03-31",
      series,
    });
    const april = eventRow({
      id: "00000000-0000-4000-8000-000000000013",
      seriesId,
      eventDate: "2025-04-30",
      series,
    });
    const { service, repository } = makeService([
      past,
      selected,
      march,
      april,
    ]);

    await service.update(ORGANIZER, selected.id, {
      scope: "SERIES",
      recurrence: { frequency: "MONTHLY", end: { kind: "COUNT", count: 4 } },
    });

    expect(repository.createOccurrences.mock.calls.at(-1)?.[1]).toEqual([
      expect.objectContaining({ eventDate: "2025-02-28" }),
      expect.objectContaining({ eventDate: "2025-03-31" }),
      expect.objectContaining({ eventDate: "2025-04-30" }),
    ]);
    expect(repository.updateSeries).toHaveBeenCalledWith(
      expect.anything(),
      ORGANIZER,
      seriesId,
      expect.objectContaining({ startsOn: "2025-01-31" }),
    );
    expect(repository.findOwnedByIds).toHaveBeenCalledWith(
      expect.anything(),
      ORGANIZER,
      expect.arrayContaining(
        repository.rows
          .filter((row) => row.eventDate >= "2025-02-28")
          .map((row) => row.id),
      ),
    );
    expect(repository.rows).toContain(past);
  });

  it("uses an explicit eventDate as the new recurrence anchor", async () => {
    vi.setSystemTime(new Date("2025-02-28T12:00:00.000Z"));
    const seriesId = "00000000-0000-4000-8000-000000000020";
    const selected = eventRow({
      seriesId,
      eventDate: "2025-02-28",
      series: {
        id: seriesId,
        frequency: "MONTHLY",
        startsOn: "2025-01-31",
        endsOn: null,
        occurrenceCount: 4,
      },
    });
    const { service, repository } = makeService([selected]);

    await service.update(ORGANIZER, selected.id, {
      scope: "SERIES",
      eventDate: "2025-03-01",
      recurrence: { frequency: "MONTHLY", end: { kind: "COUNT", count: 3 } },
    });

    expect(repository.createOccurrences.mock.calls.at(-1)?.[1]).toEqual([
      expect.objectContaining({ eventDate: "2025-03-01" }),
      expect.objectContaining({ eventDate: "2025-04-01" }),
      expect.objectContaining({ eventDate: "2025-05-01" }),
    ]);
  });

  it("emits every updated series occurrence with its own recipients", async () => {
    const seriesId = "00000000-0000-4000-8000-000000000020";
    const series = {
      id: seriesId,
      frequency: "WEEKLY",
      startsOn: "2026-09-03",
      endsOn: null,
      occurrenceCount: 5,
    };
    const first = eventRow({
      seriesId,
      series,
      attendeeCount: 1,
      attendeeIds: [STUDENT_A],
    });
    const second = eventRow({
      id: "00000000-0000-4000-8000-000000000013",
      seriesId,
      series,
      eventDate: "2026-09-17",
      attendeeCount: 1,
      attendeeIds: [STUDENT_B],
    });
    const { service, emitter } = makeService([first, second]);

    await service.update(ORGANIZER, first.id, {
      scope: "SERIES",
      title: "Yeni seri",
    });

    expect(emitter.emit).toHaveBeenCalledWith(
      CoachingEventTopic.PLAN_EVENT_UPDATED,
      expect.objectContaining({
        occurrences: [
          expect.objectContaining({
            eventId: first.id,
            title: "Yeni seri",
            recipientUserIds: [STUDENT_A],
          }),
          expect.objectContaining({
            eventId: second.id,
            title: "Yeni seri",
            recipientUserIds: [STUDENT_B],
          }),
        ],
      }),
    );
  });

  it("emits every cancelled series occurrence with its own recipients", async () => {
    const seriesId = "00000000-0000-4000-8000-000000000020";
    const first = eventRow({
      seriesId,
      attendeeCount: 1,
      attendeeIds: [STUDENT_A],
    });
    const second = eventRow({
      id: "00000000-0000-4000-8000-000000000013",
      seriesId,
      eventDate: "2026-09-17",
      attendeeCount: 1,
      attendeeIds: [STUDENT_B],
    });
    const { service, repository, emitter } = makeService([first, second]);

    await service.cancel(ORGANIZER, first.id, { scope: "SERIES" });

    expect(repository.cancelFutureSeries).toHaveBeenCalledWith(
      expect.anything(),
      ORGANIZER,
      seriesId,
      "2026-09-09",
    );
    expect(emitter.emit).toHaveBeenCalledWith(
      "coaching.plan-event.cancelled",
      expect.objectContaining({
        occurrences: [
          expect.objectContaining({
            eventId: first.id,
            status: "CANCELLED",
            recipientUserIds: [STUDENT_A],
          }),
          expect.objectContaining({
            eventId: second.id,
            status: "CANCELLED",
            recipientUserIds: [STUDENT_B],
          }),
        ],
      }),
    );
  });

  it("uses Istanbul today for occurrence mutability", async () => {
    vi.setSystemTime(new Date("2026-09-08T21:30:00.000Z"));
    const past = eventRow({ eventDate: "2026-09-08" });
    const { service } = makeService([past]);

    await expect(
      service.cancel(ORGANIZER, past.id, { scope: "OCCURRENCE" }),
    ).rejects.toMatchObject({
      code: ErrorCode.COACHING_EVENT_DATE_READONLY,
    });
  });

  it("updates through the caller transaction and returns the current event id", async () => {
    const original = eventRow();
    const { service, repository, emitter } = makeService([original]);
    const tx = { execute: vi.fn() };
    await service.lockOrganizerInTransaction(tx as never, ORGANIZER);
    const result = await service.updateInTransaction(
      tx as never,
      ORGANIZER,
      original.id,
      { scope: "OCCURRENCE", title: "Yeni başlık" },
    );
    expect(repository.updateOccurrence).toHaveBeenCalledWith(
      tx,
      ORGANIZER,
      original.id,
      expect.any(Object),
    );
    expect(result.dto.id).toBe(original.id);
    expect(repository.acquireOrganizerLock).toHaveBeenCalledTimes(1);
    expect(emitter.emit).not.toHaveBeenCalled();
    service.publishUpdated(ORGANIZER, result);
    expect(emitter.emit).toHaveBeenCalledWith(
      CoachingEventTopic.PLAN_EVENT_UPDATED,
      expect.any(Object),
    );
  });

  it("cancels and publishes separately through the caller transaction", async () => {
    const original = eventRow({ attendeeIds: [STUDENT_A] });
    const { service, repository, emitter } = makeService([original]);
    const tx = { execute: vi.fn() };
    await service.lockOrganizerInTransaction(tx as never, ORGANIZER);
    const rows = await service.cancelInTransaction(
      tx as never,
      ORGANIZER,
      original.id,
      { scope: "OCCURRENCE" },
    );
    expect(repository.cancelOccurrence).toHaveBeenCalledWith(
      tx,
      ORGANIZER,
      original.id,
    );
    expect(repository.acquireOrganizerLock).toHaveBeenCalledTimes(1);
    expect(emitter.emit).not.toHaveBeenCalled();
    service.publishCancelled(ORGANIZER, rows);
    expect(emitter.emit).toHaveBeenCalledWith(
      CoachingEventTopic.PLAN_EVENT_CANCELLED,
      expect.any(Object),
    );
  });
});
