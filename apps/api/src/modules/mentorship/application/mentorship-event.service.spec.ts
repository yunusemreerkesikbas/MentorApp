import { describe, expect, it, vi } from "vitest";
import { MentorshipEventService } from "./mentorship-event.service";

const COACH = "00000000-0000-4000-8000-000000000001";
const STUDENT_A = "00000000-0000-4000-8000-000000000002";
const STUDENT_B = "00000000-0000-4000-8000-000000000003";
const EVENT = "00000000-0000-4000-8000-000000000010";
const REPLACEMENT = "00000000-0000-4000-8000-000000000011";
const TX = { execute: vi.fn() };

function setup(rejectStudent?: string) {
  const links = {
    assertEnabled: vi.fn(),
    listActiveScopes: vi.fn(async () => [
      { studentId: STUDENT_A, mentorshipLinkId: `link:${STUDENT_A}` },
      { studentId: STUDENT_B, mentorshipLinkId: `link:${STUDENT_B}` },
    ]),
    requireActiveLink: vi.fn(async (_coachId: string, studentId: string) => {
      if (studentId === rejectStudent) throw new Error("inactive link");
      return { id: `link:${studentId}`, studentId };
    }),
    withActiveLinksLocked: vi.fn(
      async (
        _coachId: string,
        requested:
          | string[]
          | ((tx: unknown) => Promise<string[]>),
        callback: (tx: unknown) => Promise<unknown>,
      ) => {
        const studentIds =
          typeof requested === "function" ? await requested(TX) : requested;
        if (studentIds.includes(rejectStudent ?? "")) {
          throw new Error("inactive link");
        }
        return callback(TX);
      },
    ),
  };
  const planEvents = {
    create: vi.fn(async (_coachId, input) => ({ id: EVENT, ...input })),
    update: vi.fn(async (_coachId, _eventId, input) => ({ id: EVENT, ...input })),
    cancel: vi.fn(),
    createInTransaction: vi.fn(async () => ({
      dto: { id: EVENT },
      occurrences: [],
    })),
    updateInTransaction: vi.fn(async () => ({
      dto: { id: REPLACEMENT },
      occurrences: [],
    })),
    listEventAttendeeIdsInTransaction: vi.fn(async () => [STUDENT_A]),
    publishCreated: vi.fn(),
    publishUpdated: vi.fn(),
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

    expect(links.withActiveLinksLocked).toHaveBeenCalledWith(
      COACH,
      [STUDENT_A, STUDENT_B],
      expect.any(Function),
    );
    expect(planEvents.createInTransaction).not.toHaveBeenCalled();
  });

  it("allows a personal event with no attendees", async () => {
    const { service, links, planEvents } = setup();

    await service.create(COACH, {
      title: "Hazırlık",
      eventDate: "2026-09-10",
      attendeeIds: [],
    });

    expect(links.assertEnabled).toHaveBeenCalledOnce();
    expect(planEvents.createInTransaction).toHaveBeenCalledWith(
      TX,
      COACH,
      expect.objectContaining({ attendeeIds: [] }),
    );
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
    expect(planEvents.createInTransaction).not.toHaveBeenCalled();
  });

  it("validates replacement attendees on update and delegates OCCURRENCE/SERIES semantics", async () => {
    const { service, links, planEvents } = setup();

    await service.update(COACH, EVENT, {
      scope: "SERIES",
      title: "Yeni görüşme",
      attendeeIds: [STUDENT_A, STUDENT_B],
    });

    expect(planEvents.updateInTransaction).toHaveBeenCalledWith(
      TX,
      COACH,
      EVENT,
      {
        scope: "SERIES",
        title: "Yeni görüşme",
        attendeeIds: [STUDENT_A, STUDENT_B],
      },
    );
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

  it("hydrates the replacement id returned by a regenerated SERIES update", async () => {
    const { service, planEvents } = setup();
    await service.update(COACH, EVENT, {
      scope: "SERIES",
      eventDate: "2026-09-12",
      attendeeIds: [STUDENT_A],
    });
    expect(planEvents.getCoachEventData).toHaveBeenCalledWith(
      COACH,
      REPLACEMENT,
      expect.any(Array),
    );
  });

  it("rejects more than 100 attendees before opening the locked-link transaction", async () => {
    const { service, links, planEvents } = setup();
    const attendeeIds = Array.from(
      { length: 101 },
      (_, index) =>
        `00000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`,
    );
    await expect(
      service.create(COACH, {
        title: "Kalabalık",
        eventDate: "2026-09-10",
        attendeeIds,
      }),
    ).rejects.toMatchObject({ code: "MENTORSHIP_EVENT_ATTENDEE_LIMIT" });
    expect(links.withActiveLinksLocked).not.toHaveBeenCalled();
    expect(planEvents.createInTransaction).not.toHaveBeenCalled();
  });
});
