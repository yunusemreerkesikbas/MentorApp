import { describe, expect, it, vi } from "vitest";
import type { PlanEventDto, PlanTaskDto } from "@mentor/types";
import { MentorshipPlanOrchestrationService } from "./mentorship-plan-orchestration.service";

const COACH = "00000000-0000-4000-8000-000000000001";
const STUDENT_A = "00000000-0000-4000-8000-000000000002";
const STUDENT_B = "00000000-0000-4000-8000-000000000003";
const LINK_A = "00000000-0000-4000-8000-000000000012";
const LINK_B = "00000000-0000-4000-8000-000000000013";
const GROUP = "00000000-0000-4000-8000-000000000020";

function task(overrides: Partial<PlanTaskDto>): PlanTaskDto {
  return {
    id: crypto.randomUUID(),
    title: "Paragraf",
    subject: "Türkçe",
    topic: null,
    status: "PENDING",
    sortOrder: 0,
    taskDate: "2026-09-10",
    startTime: null,
    endTime: null,
    description: null,
    coachNote: null,
    origin: null,
    assignmentGroupId: null,
    ...overrides,
  };
}

function event(overrides: Partial<PlanEventDto> = {}): PlanEventDto {
  return {
    id: "00000000-0000-4000-8000-000000000030",
    seriesId: null,
    organizerUserId: COACH,
    orgId: null,
    title: "Görüşme",
    description: "Koçun kendi notu",
    eventDate: "2026-09-10",
    startTime: "10:00",
    endTime: "10:30",
    status: "SCHEDULED",
    attendeeCount: 2,
    recurrence: null,
    createdAt: "2026-09-09T10:00:00.000Z",
    updatedAt: "2026-09-09T10:00:00.000Z",
    ...overrides,
  };
}

describe("MentorshipPlanOrchestrationService", () => {
  it("groups coach assignments after privacy filtering and resolves public avatars", async () => {
    const links = {
      assertEnabled: vi.fn(),
      listActiveScopes: vi.fn(async () => [
        { studentId: STUDENT_A, mentorshipLinkId: LINK_A },
        { studentId: STUDENT_B, mentorshipLinkId: LINK_B },
      ]),
    };
    const coaching = {
      listCoachPlanData: vi.fn(async () => ({
        personalTasks: [
          task({
            id: "00000000-0000-4000-8000-000000000040",
            title: "Koçun kişisel görevi",
            description: "Koçun kendi notu",
          }),
        ],
        mentorshipTasks: [
          {
            studentId: STUDENT_A,
            mentorshipLinkId: LINK_A,
            task: task({
              id: "00000000-0000-4000-8000-000000000041",
              assignmentGroupId: GROUP,
              description: "öğrencinin gizli açıklaması",
              coachNote: "20 soru",
            }),
          },
          {
            studentId: STUDENT_B,
            mentorshipLinkId: LINK_B,
            task: task({
              id: "00000000-0000-4000-8000-000000000042",
              assignmentGroupId: GROUP,
              description: "başka bir gizli açıklama",
              coachNote: "20 soru",
            }),
          },
        ],
        events: [{ event: event(), attendeeIds: [STUDENT_A, STUDENT_B] }],
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
          [
            STUDENT_B,
            {
              userId: STUDENT_B,
              displayName: "Bora",
              username: null,
              avatarUrl: null,
            },
          ],
        ]),
      ),
    };
    const service = new MentorshipPlanOrchestrationService(
      links as never,
      coaching as never,
      users as never,
    );

    const result = await service.list(COACH, {
      from: "2026-09-09",
      to: "2026-09-20",
      page: 1,
      pageSize: 20,
    });

    expect(result.total).toBe(3);
    expect(result.items.map((item) => item.kind)).toEqual(["TASK", "TASK", "EVENT"]);
    const grouped = result.items.find(
      (item) => item.kind === "TASK" && item.task.assignmentGroupId === GROUP,
    );
    expect(grouped).toMatchObject({
      kind: "TASK",
      task: {
        participants: [
          {
            studentId: STUDENT_A,
            studentDisplayName: "Ayşe",
            avatarUrl: "https://cdn.example/ayse.png",
            status: "PENDING",
          },
          {
            studentId: STUDENT_B,
            studentDisplayName: "Bora",
            avatarUrl: null,
            status: "PENDING",
          },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toContain("gizli açıklama");
    expect(result.items.at(-1)).toMatchObject({
      kind: "EVENT",
      event: {
        attendees: [
          { studentId: STUDENT_A, studentDisplayName: "Ayşe" },
          { studentId: STUDENT_B, studentDisplayName: "Bora" },
        ],
      },
    });
  });

  it("authorizes a student filter before asking W2 for data", async () => {
    const links = {
      assertEnabled: vi.fn(),
      requireActiveLink: vi.fn(async () => ({
        id: LINK_A,
        studentId: STUDENT_A,
      })),
    };
    const coaching = {
      listCoachPlanData: vi.fn(async () => ({
        personalTasks: [],
        mentorshipTasks: [],
        events: [],
      })),
    };
    const service = new MentorshipPlanOrchestrationService(
      links as never,
      coaching as never,
      { listDisplayIdentities: vi.fn(async () => new Map()) } as never,
    );

    await service.list(COACH, {
      from: "2026-09-09",
      to: "2026-09-20",
      studentId: STUDENT_A,
      page: 1,
      pageSize: 20,
    });

    expect(links.requireActiveLink).toHaveBeenCalledWith(COACH, STUDENT_A);
    expect(coaching.listCoachPlanData).toHaveBeenCalledWith(
      COACH,
      [{ studentId: STUDENT_A, mentorshipLinkId: LINK_A }],
      { from: "2026-09-09", to: "2026-09-20" },
    );
  });
});
