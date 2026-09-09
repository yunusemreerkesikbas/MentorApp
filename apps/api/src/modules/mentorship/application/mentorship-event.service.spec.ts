import { describe, expect, it, vi } from "vitest";
import { MentorshipEventService } from "./mentorship-event.service";

const COACH = "00000000-0000-4000-8000-000000000001";
const STUDENT_A = "00000000-0000-4000-8000-000000000002";
const STUDENT_B = "00000000-0000-4000-8000-000000000003";
const EVENT = "00000000-0000-4000-8000-000000000010";

function setup(rejectStudent?: string) {
  const links = {
    assertEnabled: vi.fn(),
    requireActiveLink: vi.fn(async (_coachId: string, studentId: string) => {
      if (studentId === rejectStudent) throw new Error("inactive link");
      return { id: `link:${studentId}`, studentId };
    }),
  };
  const planEvents = {
    create: vi.fn(async (_coachId, input) => ({ id: EVENT, ...input })),
    update: vi.fn(async (_coachId, _eventId, input) => ({ id: EVENT, ...input })),
    cancel: vi.fn(),
    getCoachEventData: vi.fn(async () => ({
      event: {
        id: EVENT,
        seriesId: null,
        organizerUserId: COACH,
        orgId: null,
        title: "Görüşme",
        description: null,
        eventDate: "2026-09-10",
        startTime: null,
        endTime: null,
        status: "SCHEDULED",
        attendeeCount: 1,
        recurrence: null,
        createdAt: "2026-09-09T10:00:00.000Z",
        updatedAt: "2026-09-09T10:00:00.000Z",
      },
      attendeeIds: [STUDENT_A],
    })),
  };
  const users = {
    listDisplayIdentities: vi.fn(async () =>
      new Map([
        [
          STUDENT_A,
          {
            userId: STUDENT_A,
            displayName: "Ayşe",
            username: "ayse",
            avatarUrl: "https://cdn.example/ayse.png",
          },
        ],
      ]),
    ),
  };
  return {
    links,
    planEvents,
    users,
    service: new MentorshipEventService(
      links as never,
      planEvents as never,
      users as never,
    ),
  };
}

describe("MentorshipEventService", () => {
  it("validates every attendee link before W2 creates anything", async () => {
    const { service, links, planEvents } = setup(STUDENT_B);

    await expect(
      service.create(COACH, {
        title: "Görüşme",
        eventDate: "2026-09-10",
        attendeeIds: [STUDENT_A, STUDENT_B],
      }),
    ).rejects.toThrow("inactive link");

    expect(links.requireActiveLink).toHaveBeenCalledTimes(2);
    expect(planEvents.create).not.toHaveBeenCalled();
  });

  it("allows a personal event with no attendees", async () => {
    const { service, links, planEvents } = setup();

    await service.create(COACH, {
      title: "Hazırlık",
      eventDate: "2026-09-10",
      attendeeIds: [],
    });

    expect(links.assertEnabled).toHaveBeenCalledOnce();
    expect(links.requireActiveLink).not.toHaveBeenCalled();
    expect(planEvents.create).toHaveBeenCalledOnce();
  });

  it("returns full public attendee identities on the coach-only event DTO", async () => {
    const { service } = setup();

    const created = await service.create(COACH, {
      title: "Görüşme",
      eventDate: "2026-09-10",
      attendeeIds: [STUDENT_A],
    });

    expect(created).toMatchObject({
      attendees: [
        {
          studentId: STUDENT_A,
          studentDisplayName: "Ayşe",
          studentUsername: "ayse",
          avatarUrl: "https://cdn.example/ayse.png",
        },
      ],
    });
    expect(JSON.stringify(created)).not.toContain("avatarStorageKey");
  });

  it("refuses the implicit organizer as an attendee", async () => {
    const { service, planEvents } = setup();

    await expect(
      service.create(COACH, {
        title: "Görüşme",
        eventDate: "2026-09-10",
        attendeeIds: [COACH],
      }),
    ).rejects.toMatchObject({ code: "MENTORSHIP_EVENT_ORGANIZER_ATTENDEE" });
    expect(planEvents.create).not.toHaveBeenCalled();
  });

  it("validates replacement attendees on update and delegates OCCURRENCE/SERIES semantics", async () => {
    const { service, links, planEvents } = setup();

    await service.update(COACH, EVENT, {
      scope: "SERIES",
      title: "Yeni görüşme",
      attendeeIds: [STUDENT_A, STUDENT_B],
    });

    expect(links.requireActiveLink).toHaveBeenNthCalledWith(1, COACH, STUDENT_A);
    expect(links.requireActiveLink).toHaveBeenNthCalledWith(2, COACH, STUDENT_B);
    expect(planEvents.update).toHaveBeenCalledWith(COACH, EVENT, {
      scope: "SERIES",
      title: "Yeni görüşme",
      attendeeIds: [STUDENT_A, STUDENT_B],
    });
  });

  it("cancels only after the mentorship kill switch passes", async () => {
    const { service, links, planEvents } = setup();

    await service.cancel(COACH, EVENT, { scope: "OCCURRENCE" });

    expect(links.assertEnabled.mock.invocationCallOrder[0]).toBeLessThan(
      planEvents.cancel.mock.invocationCallOrder[0]!,
    );
    expect(planEvents.cancel).toHaveBeenCalledWith(COACH, EVENT, {
      scope: "OCCURRENCE",
    });
  });
});
