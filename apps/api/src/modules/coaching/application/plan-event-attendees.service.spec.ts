import { beforeEach, describe, expect, it, vi } from "vitest";
import { CoachingEventTopic } from "../domain/coaching.events";
import {
  eventRow,
  makeService,
  NOW,
  ORGANIZER,
  STUDENT_A,
  STUDENT_B,
} from "./plan-event.service.fixture";

describe("PlanEventService series attendee preservation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it("preserves distinct attendee sets by future occurrence ordinal", async () => {
    const seriesId = "00000000-0000-4000-8000-000000000020";
    const series = {
      id: seriesId,
      organizerUserId: ORGANIZER,
      orgId: null,
      frequency: "WEEKLY",
      timeZone: "Europe/Istanbul",
      startsOn: "2026-09-03",
      endsOn: null,
      occurrenceCount: 4,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const selected = eventRow({
      seriesId,
      series,
      eventDate: "2026-09-10",
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
    const { service, repository, emitter } = makeService([selected, second]);

    await service.update(ORGANIZER, selected.id, {
      scope: "SERIES",
      recurrence: {
        frequency: "WEEKLY",
        end: { kind: "COUNT", count: 4 },
      },
    });

    expect(repository.listFutureSeries).toHaveBeenCalledWith(
      expect.anything(),
      ORGANIZER,
      seriesId,
      "2026-09-09",
    );
    const regenerated = repository.rows
      .filter((row) => row.seriesId === seriesId)
      .sort((left, right) => left.eventDate.localeCompare(right.eventDate));
    expect(regenerated.map((row) => row.eventDate)).toEqual([
      "2026-09-10",
      "2026-09-17",
      "2026-09-24",
    ]);
    expect(regenerated.map((row) => row.attendeeIds)).toEqual([
      [STUDENT_A],
      [STUDENT_B],
      [STUDENT_A],
    ]);
    expect(emitter.emit).toHaveBeenCalledWith(
      CoachingEventTopic.PLAN_EVENT_UPDATED,
      expect.objectContaining({
        occurrences: [
          expect.objectContaining({ recipientUserIds: [STUDENT_A] }),
          expect.objectContaining({ recipientUserIds: [STUDENT_B] }),
          expect.objectContaining({ recipientUserIds: [STUDENT_A] }),
        ],
      }),
    );
  });
});
