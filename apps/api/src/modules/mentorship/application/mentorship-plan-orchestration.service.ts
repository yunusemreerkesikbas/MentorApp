import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type {
  CoachPlanEventAttendeeDto,
  CoachPlanGroupedTaskDto,
  CoachPlanItemDto,
  Paginated,
  PlanTaskDto,
} from "@mentor/types";
import type { ListMentorshipPlanQuery } from "@mentor/validation";
import { PlanEventService } from "../../coaching/application/plan-event.service";
import { todayInIstanbul } from "../../coaching/domain/date.util";
import {
  type DisplayIdentity,
  UsersService,
} from "../../identity/application/users.service";
import { MentorshipLinkService } from "./mentorship-link.service";

@Injectable()
export class MentorshipPlanOrchestrationService {
  constructor(
    private readonly links: MentorshipLinkService,
    private readonly coaching: PlanEventService,
    private readonly users: UsersService,
  ) {}

  async list(
    coachId: string,
    query: ListMentorshipPlanQuery,
  ): Promise<Paginated<CoachPlanItemDto>> {
    await this.links.assertEnabled();
    const scopes = query.studentId
      ? [await this.scopeForStudent(coachId, query.studentId)]
      : await this.links.listActiveScopes(coachId);
    const date = todayInIstanbul();
    const range = { from: query.from ?? date, to: query.to ?? date };
    const [data, identities] = await Promise.all([
      this.coaching.listCoachPlanData(coachId, scopes, range),
      this.users.listDisplayIdentities(
        scopes.map((scope) => scope.studentId),
      ),
    ]);
    const mentorshipTasks = query.studentId
      ? data.mentorshipTasks.filter(
          (row) => row.studentId === query.studentId,
        )
      : data.mentorshipTasks;
    const events = query.studentId
      ? data.events.filter(({ attendeeIds }) =>
          attendeeIds.includes(query.studentId!),
        )
      : data.events;
    const items = [
      ...(query.studentId ? [] : data.personalTasks).map((task) => ({
        kind: "TASK" as const,
        task: this.personalTask(task),
      })),
      ...this.groupAssignments(mentorshipTasks, identities),
      ...events.map(({ event, attendeeIds }) => ({
        kind: "EVENT" as const,
        event: {
          ...event,
          attendees: attendeeIds.map((id) =>
            this.eventAttendee(id, identities.get(id)),
          ),
        },
      })),
    ].sort(compareCoachPlanItems);
    const offset = (query.page - 1) * query.pageSize;
    return {
      items: items.slice(offset, offset + query.pageSize),
      total: items.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  private async scopeForStudent(coachId: string, studentId: string) {
    const link = await this.links.requireActiveLink(coachId, studentId);
    return { studentId, mentorshipLinkId: link.id };
  }

  private personalTask(task: PlanTaskDto): CoachPlanGroupedTaskDto {
    return {
      id: task.id,
      assignmentGroupId: null,
      status: task.status,
      taskDate: task.taskDate,
      title: task.title,
      subject: task.subject,
      topic: task.topic,
      startTime: task.startTime,
      endTime: task.endTime,
      coachNote: task.coachNote,
      participants: [],
    };
  }

  private groupAssignments(
    rows: Awaited<ReturnType<PlanEventService["listCoachPlanData"]>>["mentorshipTasks"],
    identities: Map<string, DisplayIdentity>,
  ): Array<{ kind: "TASK"; task: CoachPlanGroupedTaskDto }> {
    const groups = new Map<string, CoachPlanGroupedTaskDto>();
    for (const row of rows) {
      const signature = visibleTaskSignature(row.task);
      const key = row.task.assignmentGroupId
        ? `${row.task.assignmentGroupId}:${signature}`
        : row.task.id;
      const group = groups.get(key) ?? {
        id: row.task.assignmentGroupId
          ? `${row.task.assignmentGroupId}:${shortHash(signature)}`
          : row.task.id,
        assignmentGroupId: row.task.assignmentGroupId,
        status: null,
        taskDate: row.task.taskDate,
        title: row.task.title,
        subject: row.task.subject,
        topic: row.task.topic,
        startTime: row.task.startTime,
        endTime: row.task.endTime,
        coachNote: row.task.coachNote,
        participants: [],
      };
      const identity = identities.get(row.studentId);
      group.participants.push({
        studentId: row.studentId,
        studentDisplayName: identity?.displayName ?? "",
        studentUsername: identity?.username ?? null,
        avatarUrl: identity?.avatarUrl ?? null,
        taskId: row.task.id,
        status: row.task.status,
      });
      groups.set(key, group);
    }
    return [...groups.values()].map((task) => {
      task.participants.sort((left, right) =>
        left.studentId.localeCompare(right.studentId),
      );
      return { kind: "TASK", task };
    });
  }

  private eventAttendee(
    studentId: string,
    identity: DisplayIdentity | undefined,
  ): CoachPlanEventAttendeeDto {
    return {
      studentId,
      studentDisplayName: identity?.displayName ?? "",
      studentUsername: identity?.username ?? null,
      avatarUrl: identity?.avatarUrl ?? null,
    };
  }
}

function visibleTaskSignature(task: PlanTaskDto): string {
  return JSON.stringify([
    task.taskDate,
    task.title,
    task.subject,
    task.topic,
    task.startTime,
    task.endTime,
    task.coachNote,
  ]);
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function compareCoachPlanItems(left: CoachPlanItemDto, right: CoachPlanItemDto) {
  const leftValue =
    left.kind === "TASK"
      ? [left.task.taskDate, left.task.startTime ?? "", left.task.id]
      : [left.event.eventDate, left.event.startTime ?? "", left.event.id];
  const rightValue =
    right.kind === "TASK"
      ? [right.task.taskDate, right.task.startTime ?? "", right.task.id]
      : [right.event.eventDate, right.event.startTime ?? "", right.event.id];
  return leftValue.join(":").localeCompare(rightValue.join(":"));
}
