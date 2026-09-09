import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "../../../common/errors/error-code";
import {
  eventRow,
  makeService,
  NOW,
  ORGANIZER,
  STUDENT_A,
} from "./plan-event.service.fixture";

describe("PlanEventService boundaries", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it("checks partial DATE recurrence against the stored series anchor", async () => {
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
          end: { kind: "DATE", date: "2026-09-03" },
        },
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.COACHING_EVENT_RECURRENCE_INVALID,
    });
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

  it("uses explicit organizer/student filters and Istanbul today for link cleanup", async () => {
    vi.setSystemTime(new Date("2026-09-08T21:30:00.000Z"));
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
