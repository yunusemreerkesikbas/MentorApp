import { describe, expect, it, vi } from "vitest";
import { addDays, todayIso } from "../../coaching/domain/date.util";
import { MentorshipAssignmentService } from "./mentorship-assignment.service";

const COACH = "00000000-0000-4000-8000-000000000001";
const STUDENT_A = "00000000-0000-4000-8000-000000000002";
const STUDENT_B = "00000000-0000-4000-8000-000000000003";
const LINK_A = "00000000-0000-4000-8000-000000000012";
const LINK_B = "00000000-0000-4000-8000-000000000013";
const TASK = "00000000-0000-4000-8000-000000000020";
const GROUP = "00000000-0000-4000-8000-000000000021";
const TX = { execute: vi.fn() };
const expectedSignature = {
  taskDate: todayIso(),
  title: "Paragraf",
  subject: null,
  topic: null,
  startTime: null,
  endTime: null,
  coachNote: null,
};

function setup(rejectStudent?: string) {
  const links = {
    assertEnabled: vi.fn(),
    requireActiveLink: vi.fn(async (_coachId: string, studentId: string) => {
      if (studentId === rejectStudent) throw new Error("inactive link");
      return {
        id: studentId === STUDENT_A ? LINK_A : LINK_B,
        studentId,
      };
    }),
    withServiceTransaction: vi.fn(
      async (callback: (tx: unknown) => Promise<unknown>) => callback(TX),
    ),
    requireActiveLinksInTransaction: vi.fn(
      async (_tx: unknown, _coachId: string, studentIds: string[]) => {
        if (studentIds.includes(rejectStudent ?? "")) {
          throw new Error("inactive link");
        }
        return [...studentIds].sort().map((studentId) => ({
            studentId,
            mentorshipLinkId: studentId === STUDENT_A ? LINK_A : LINK_B,
          }));
      },
    ),
  };
  const plan = {
    createFromMentorship: vi.fn(async () => []),
    createMentorshipBatch: vi.fn(async () => []),
    updateMentorshipTask: vi.fn(async () => ({ id: TASK })),
    removeMentorshipTask: vi.fn(),
    updateMentorshipTaskGroup: vi.fn(async () => []),
    removeMentorshipTaskGroup: vi.fn(),
    createFromMentorshipInTransaction: vi.fn(async () => [
      {
        id: TASK,
        taskDate: todayIso(),
        origin: { type: "MENTORSHIP", linkId: LINK_A },
      },
    ]),
    createMentorshipBatchInTransaction: vi.fn(async () => []),
    updateMentorshipTaskInTransaction: vi.fn(async () => ({
      id: TASK,
      taskDate: "2026-09-15",
      origin: { type: "MENTORSHIP", linkId: LINK_A },
    })),
    removeMentorshipTaskInTransaction: vi.fn(),
    // Returned out of scope order, with a different date per student, so matching is by link.
    updateMentorshipTaskGroupInTransaction: vi.fn(async () =>
      [LINK_B, LINK_A].map((linkId) => ({
        id: `${linkId}-task`,
        taskDate: linkId === LINK_A ? todayIso() : addDays(todayIso(), 1),
        origin: { type: "MENTORSHIP", linkId },
      })),
    ),
    removeMentorshipTaskGroupInTransaction: vi.fn(),
    publishMentorshipTasksCreated: vi.fn(),
  };
  const events = { emit: vi.fn() };
  const service = new MentorshipAssignmentService(
    links as never,
    plan as never,
    { listDisplayIdentities: vi.fn(async () => new Map()) } as never,
    events as never,
  );
  return { service, links, plan, events };
}

describe("MentorshipAssignmentService change announcements", () => {
  const CHANGED = "mentorship.assignments.changed";

  it("announces an edit with the task's new date and a removal without one", async () => {
    const { service, events } = setup();

    await service.updateOne(COACH, STUDENT_A, TASK, { taskDate: "2026-09-15" });
    await service.removeOne(COACH, STUDENT_A, TASK);

    expect(events.emit.mock.calls).toEqual([
      [
        CHANGED,
        expect.objectContaining({
          linkId: LINK_A,
          coachId: COACH,
          studentId: STUDENT_A,
          taskDate: "2026-09-15",
        }),
      ],
      [
        CHANGED,
        expect.objectContaining({
          linkId: LINK_A,
          coachId: COACH,
          studentId: STUDENT_A,
          taskDate: null,
        }),
      ],
    ]);
  });

  it("announces a group edit and removal once per student, each with their own task", async () => {
    const { service, events } = setup();
    const studentIds = [STUDENT_A, STUDENT_B];

    await service.updateGroup(COACH, GROUP, { studentIds, expectedSignature, title: "Yeni grup" });
    await service.removeGroup(COACH, GROUP, { studentIds, expectedSignature });

    expect(
      events.emit.mock.calls.map(([topic, event]) => [
        topic,
        event.studentId,
        event.linkId,
        event.taskDate,
      ]),
    ).toEqual([
      [CHANGED, STUDENT_A, LINK_A, todayIso()],
      [CHANGED, STUDENT_B, LINK_B, addDays(todayIso(), 1)],
      [CHANGED, STUDENT_A, LINK_A, null],
      [CHANGED, STUDENT_B, LINK_B, null],
    ]);
  });

  it("announces nothing when the write is refused", async () => {
    const { service, plan, events } = setup();
    plan.removeMentorshipTaskInTransaction.mockRejectedValueOnce(new Error("not editable"));

    await expect(service.removeOne(COACH, STUDENT_A, TASK)).rejects.toThrow("not editable");

    expect(events.emit).not.toHaveBeenCalled();
  });
});

describe("MentorshipAssignmentService orchestration", () => {
  it("authorizes every student before one atomic W2 batch call", async () => {
    const { service, links, plan } = setup();
    const input = {
      studentIds: [STUDENT_B, STUDENT_A],
      task: { title: "Paragraf", coachNote: "20 soru" },
    };

    await service.assignBatch(COACH, input);

    expect(links.requireActiveLinksInTransaction).toHaveBeenCalledWith(
      TX,
      COACH,
      [STUDENT_B, STUDENT_A],
    );
    expect(plan.createMentorshipBatchInTransaction).toHaveBeenCalledWith(
      TX,
      [
        { studentId: STUDENT_A, mentorshipLinkId: LINK_A },
        { studentId: STUDENT_B, mentorshipLinkId: LINK_B },
      ],
      input.task,
    );
  });

  it("writes nothing when any student link gate fails", async () => {
    const { service, plan } = setup(STUDENT_B);

    await expect(
      service.assignBatch(COACH, {
        studentIds: [STUDENT_A, STUDENT_B],
        task: { title: "Paragraf" },
      }),
    ).rejects.toThrow("inactive link");

    expect(plan.createMentorshipBatchInTransaction).not.toHaveBeenCalled();
  });

  it("validates the whole batch horizon before W2 is called", async () => {
    const { service, plan } = setup();

    await expect(
      service.assignBatch(COACH, {
        studentIds: [STUDENT_A, STUDENT_B],
        task: {
          title: "Çok uzak",
          taskDate: addDays(todayIso(), 121),
        },
      }),
    ).rejects.toMatchObject({ code: "MENTORSHIP_ASSIGNMENT_TOO_FAR" });

    expect(plan.createMentorshipBatchInTransaction).not.toHaveBeenCalled();
  });

  it("passes the expected active link into single update and delete", async () => {
    const { service, plan } = setup();

    await service.updateOne(COACH, STUDENT_A, TASK, {
      title: "Yeni başlık",
    });
    await service.removeOne(COACH, STUDENT_A, TASK);

    const scope = { studentId: STUDENT_A, mentorshipLinkId: LINK_A };
    expect(plan.updateMentorshipTaskInTransaction).toHaveBeenCalledWith(
      TX,
      scope,
      TASK,
      { title: "Yeni başlık" },
    );
    expect(plan.removeMentorshipTaskInTransaction).toHaveBeenCalledWith(
      TX,
      scope,
      TASK,
    );
  });

  it("authorizes every group student before group mutation", async () => {
    const { service, plan } = setup();

    await service.updateGroup(COACH, GROUP, {
      studentIds: [STUDENT_A, STUDENT_B],
      expectedSignature,
      title: "Yeni grup",
    });
    await service.removeGroup(COACH, GROUP, {
      studentIds: [STUDENT_A, STUDENT_B],
      expectedSignature,
    });

    const scopes = [
      { studentId: STUDENT_A, mentorshipLinkId: LINK_A },
      { studentId: STUDENT_B, mentorshipLinkId: LINK_B },
    ];
    expect(plan.updateMentorshipTaskGroupInTransaction).toHaveBeenCalledWith(
      TX,
      scopes,
      GROUP,
      { title: "Yeni grup" },
      expectedSignature,
    );
    expect(plan.removeMentorshipTaskGroupInTransaction).toHaveBeenCalledWith(
      TX,
      scopes,
      GROUP,
      expectedSignature,
    );
  });

  it("uses the locked link transaction for the preserved multi-task route", async () => {
    const { service, plan } = setup();
    await service.assign(COACH, STUDENT_A, {
      tasks: [{ title: "Paragraf" }],
    });
    expect(plan.createFromMentorshipInTransaction).toHaveBeenCalledWith(
      TX,
      STUDENT_A,
      [{ title: "Paragraf" }],
      LINK_A,
    );
  });
});
