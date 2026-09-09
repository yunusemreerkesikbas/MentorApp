import { beforeEach, describe, expect, it, vi } from "vitest";
import { CoachingEventTopic } from "../domain/coaching.events";
import {
  makeService,
  NOW,
  ORGANIZER,
  STUDENT_A,
  STUDENT_B,
} from "./plan-event.service.fixture";

describe("PlanEventService create and read", () => {
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
        occurrences: [
          expect.objectContaining({
            eventId: expect.any(String),
            title: "Birebir",
            eventDate: "2026-09-10",
            startTime: null,
            recipientUserIds: [STUDENT_A],
          }),
        ],
      }),
    );
  });

  it("materializes a series and emits every created occurrence", async () => {
    const { service, repository, emitter } = makeService([]);

    await service.create(ORGANIZER, {
      title: "Kontrol",
      eventDate: "2026-09-09",
      startTime: "10:00",
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
    expect(emitter.emit).toHaveBeenCalledWith(
      "coaching.plan-event.created",
      expect.objectContaining({
        occurrences: [
          expect.objectContaining({
            eventDate: "2026-09-09",
            startTime: "10:00",
            recipientUserIds: [STUDENT_A, STUDENT_B],
          }),
          expect.objectContaining({ eventDate: "2026-09-16" }),
          expect.objectContaining({ eventDate: "2026-09-23" }),
        ],
      }),
    );
  });

  it("uses Istanbul today when an event list omits its date", async () => {
    vi.setSystemTime(new Date("2026-09-08T21:30:00.000Z"));
    const { service, repository } = makeService([]);

    await service.list(STUDENT_A, { page: 1, pageSize: 20 });

    expect(repository.listParticipantPaged).toHaveBeenCalledWith(
      expect.anything(),
      STUDENT_A,
      expect.objectContaining({ date: "2026-09-09" }),
    );
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
});
