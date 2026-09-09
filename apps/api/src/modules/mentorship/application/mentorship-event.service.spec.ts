import { describe, expect, it, vi } from "vitest";
import { MentorshipEventService } from "./mentorship-event.service";

const COACH = "00000000-0000-4000-8000-000000000001";
const STUDENT_A = "00000000-0000-4000-8000-000000000002";
const STUDENT_B = "00000000-0000-4000-8000-000000000003";
const EVENT = "00000000-0000-4000-8000-000000000010";
const REPLACEMENT = "00000000-0000-4000-8000-000000000011";
const TX = { execute: vi.fn() };

function setup({
  rejectStudent,
  attendeeIds = [STUDENT_A],
  failCommit = false,
}: {
  rejectStudent?: string;
  attendeeIds?: string[];
  failCommit?: boolean;
} = {}) {
  const commit = vi.fn();
  const links = {
    assertEnabled: vi.fn(),
    listActiveScopes: vi.fn(async () => [
      { studentId: STUDENT_A, mentorshipLinkId: `link:${STUDENT_A}` },
      { studentId: STUDENT_B, mentorshipLinkId: `link:${STUDENT_B}` },
    ]),
    withServiceTransaction: vi.fn(
      async (
        callback: (tx: unknown) => Promise<unknown>,
      ) => {
        const result = await callback(TX);
        if (failCommit) throw new Error("commit failed");
        commit();
        return result;
      },
    ),
    requireActiveLinksInTransaction: vi.fn(
      async (_tx: unknown, _coachId: string, studentIds: string[]) => {
        if (studentIds.includes(rejectStudent ?? "")) {
          throw new Error("inactive link");
        }
        return studentIds.map((studentId) => ({
          studentId,
          mentorshipLinkId: `link:${studentId}`,
        }));
      },
    ),
  };
  const planEvents = {
    create: vi.fn(async (_coachId, input) => ({ id: EVENT, ...input })),
    update: vi.fn(async (_coachId, _eventId, input) => ({ id: EVENT, ...input })),
    cancel: vi.fn(),
    lockOrganizerInTransaction: vi.fn(),
    createInTransaction: vi.fn(async () => ({
      dto: { id: EVENT },
      occurrences: [],
    })),
    updateInTransaction: vi.fn(async () => ({
      dto: { id: REPLACEMENT },
      occurrences: [],
    })),
    listEventAttendeeIdsInTransaction: vi.fn(async () => attendeeIds),
    cancelInTransaction: vi.fn(async () => []),
    publishCreated: vi.fn(),
    publishUpdated: vi.fn(),
    publishCancelled: vi.fn(),
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
    commit,
    service: new MentorshipEventService(
      links as never,
      planEvents as never,
      users as never,
    ),
  };
}

describe("MentorshipEventService", () => {
  it("validates every attendee link before W2 creates anything", async () => {
    const { service, links, planEvents } = setup({
      rejectStudent: STUDENT_B,
    });

    await expect(
      service.create(COACH, {
        title: "Görüşme",
        eventDate: "2026-09-10",
        attendeeIds: [STUDENT_A, STUDENT_B],
      }),
    ).rejects.toThrow("inactive link");

    expect(planEvents.lockOrganizerInTransaction).toHaveBeenCalledWith(
      TX,
      COACH,
    );
    expect(links.requireActiveLinksInTransaction).toHaveBeenCalledWith(
      TX,
      COACH,
      [STUDENT_A, STUDENT_B],
    );
    expect(
      planEvents.lockOrganizerInTransaction.mock.invocationCallOrder[0],
    ).toBeLessThan(
      links.requireActiveLinksInTransaction.mock.invocationCallOrder[0]!,
    );
    expect(planEvents.createInTransaction).not.toHaveBeenCalled();
  });

  it("locks organizer, then active links, then creates with the same transaction", async () => {
    const { service, links, planEvents, commit } = setup();

    await service.create(COACH, {
      title: "Hazırlık",
      eventDate: "2026-09-10",
      attendeeIds: [],
    });

    expect(links.assertEnabled).toHaveBeenCalledOnce();
    expect(planEvents.lockOrganizerInTransaction).toHaveBeenCalledWith(
      TX,
      COACH,
    );
    expect(links.requireActiveLinksInTransaction).toHaveBeenCalledWith(
      TX,
      COACH,
      [],
    );
    expect(planEvents.createInTransaction).toHaveBeenCalledWith(
      TX,
      COACH,
      expect.objectContaining({ attendeeIds: [] }),
    );
    expect(
      planEvents.lockOrganizerInTransaction.mock.invocationCallOrder[0],
    ).toBeLessThan(
      links.requireActiveLinksInTransaction.mock.invocationCallOrder[0]!,
    );
    expect(
      links.requireActiveLinksInTransaction.mock.invocationCallOrder[0],
    ).toBeLessThan(planEvents.createInTransaction.mock.invocationCallOrder[0]!);
    expect(commit.mock.invocationCallOrder[0]).toBeLessThan(
      planEvents.publishCreated.mock.invocationCallOrder[0]!,
    );
  });

  it("returns full public attendee identities on the coach-only event DTO", async () => {
    const { service, links, planEvents } = setup();

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
    expect(
      planEvents.lockOrganizerInTransaction.mock.invocationCallOrder[0],
    ).toBeLessThan(
      links.requireActiveLinksInTransaction.mock.invocationCallOrder[0]!,
    );
    expect(
      links.requireActiveLinksInTransaction.mock.invocationCallOrder[0],
    ).toBeLessThan(planEvents.createInTransaction.mock.invocationCallOrder[0]!);
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
    expect(planEvents.lockOrganizerInTransaction).toHaveBeenCalledWith(
      TX,
      COACH,
    );
    expect(links.requireActiveLinksInTransaction).toHaveBeenCalledWith(
      TX,
      COACH,
      [STUDENT_A, STUDENT_B],
    );
    expect(
      planEvents.lockOrganizerInTransaction.mock.invocationCallOrder[0],
    ).toBeLessThan(
      links.requireActiveLinksInTransaction.mock.invocationCallOrder[0]!,
    );
    expect(
      links.requireActiveLinksInTransaction.mock.invocationCallOrder[0],
    ).toBeLessThan(planEvents.updateInTransaction.mock.invocationCallOrder[0]!);
  });

  it("resolves attendees and cancels after organizer and active-link locks in the same tx", async () => {
    const { service, links, planEvents, commit } = setup({
      attendeeIds: [STUDENT_B, STUDENT_A],
    });

    const input = { scope: "OCCURRENCE" as const };
    await service.cancel(COACH, EVENT, input);

    expect(planEvents.lockOrganizerInTransaction).toHaveBeenCalledWith(
      TX,
      COACH,
    );
    expect(planEvents.listEventAttendeeIdsInTransaction).toHaveBeenCalledWith(
      TX,
      COACH,
      EVENT,
      "OCCURRENCE",
    );
    expect(links.requireActiveLinksInTransaction).toHaveBeenCalledWith(
      TX,
      COACH,
      [STUDENT_B, STUDENT_A],
    );
    expect(planEvents.cancelInTransaction).toHaveBeenCalledWith(
      TX,
      COACH,
      EVENT,
      input,
    );
    expect(
      planEvents.lockOrganizerInTransaction.mock.invocationCallOrder[0],
    ).toBeLessThan(
      links.requireActiveLinksInTransaction.mock.invocationCallOrder[0]!,
    );
    expect(
      links.requireActiveLinksInTransaction.mock.invocationCallOrder[0],
    ).toBeLessThan(planEvents.cancelInTransaction.mock.invocationCallOrder[0]!);
    expect(commit.mock.invocationCallOrder[0]).toBeLessThan(
      planEvents.publishCancelled.mock.invocationCallOrder[0]!,
    );
  });

  it("refuses cancellation when an affected attendee link ended", async () => {
    const { service, planEvents } = setup({
      attendeeIds: [STUDENT_A, STUDENT_B],
      rejectStudent: STUDENT_B,
    });
    await expect(
      service.cancel(COACH, EVENT, { scope: "SERIES" }),
    ).rejects.toThrow("inactive link");
    expect(planEvents.cancelInTransaction).not.toHaveBeenCalled();
    expect(planEvents.publishCancelled).not.toHaveBeenCalled();
  });

  it("allows cancellation of a personal event with no attendee links", async () => {
    const { service, links, planEvents } = setup({ attendeeIds: [] });
    await service.cancel(COACH, EVENT, { scope: "OCCURRENCE" });
    expect(links.requireActiveLinksInTransaction).toHaveBeenCalledWith(
      TX,
      COACH,
      [],
    );
    expect(planEvents.cancelInTransaction).toHaveBeenCalledOnce();
  });

  it("does not publish cancellation when the shared transaction rolls back", async () => {
    const { service, planEvents } = setup({ failCommit: true });
    await expect(
      service.cancel(COACH, EVENT, { scope: "OCCURRENCE" }),
    ).rejects.toThrow("commit failed");
    expect(planEvents.cancelInTransaction).toHaveBeenCalledOnce();
    expect(planEvents.publishCancelled).not.toHaveBeenCalled();
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
    expect(links.withServiceTransaction).not.toHaveBeenCalled();
    expect(planEvents.createInTransaction).not.toHaveBeenCalled();
  });
});
