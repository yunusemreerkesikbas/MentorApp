import type { PlanEventDto, PlanTaskDto } from "@mentor/types";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { PlanEventRepository } from "../infrastructure/plan-event.repository";
import { PlanTaskRepository } from "../infrastructure/plan-task.repository";
import { toPlanTaskDto } from "./coaching.mappers";
import { toPlanEventDto } from "./plan-event.mapper";
import { notFound } from "./plan-event-mutation";

export interface CoachPlanScope {
  mentorshipLinkId: string;
  studentId: string;
}

export interface CoachPlanAggregate extends CoachPlanScope {
  tasks: PlanTaskDto[];
  events: PlanEventDto[];
}

export interface CoachPlanData {
  personalTasks: PlanTaskDto[];
  mentorshipTasks: Array<CoachPlanScope & { task: PlanTaskDto }>;
  events: Array<{ event: PlanEventDto; attendeeIds: string[] }>;
}

export class PlanEventCoachQuery {
  constructor(
    private readonly db: Database,
    private readonly events: PlanEventRepository,
    private readonly tasks: PlanTaskRepository,
  ) {}

  async listAuthorized(
    organizerUserId: string,
    scopes: CoachPlanScope[],
    range: { from: string; to: string },
  ): Promise<CoachPlanAggregate[]> {
    if (scopes.length === 0) return [];
    return withServiceContext(this.db, async (tx) => {
      const studentIds = [...new Set(scopes.map((scope) => scope.studentId))];
      const [eventRows, taskRows] = await Promise.all([
        this.events.listAuthorizedForCoach(
          tx,
          organizerUserId,
          studentIds,
          range.from,
          range.to,
        ),
        this.tasks.listMentorshipTasksForCoach(
          tx,
          scopes,
          range.from,
          range.to,
        ),
      ]);
      return scopes.map((scope) => ({
        ...scope,
        tasks: taskRows
          .filter(
            (row) =>
              row.userId === scope.studentId &&
              row.originRefId === scope.mentorshipLinkId,
          )
          .map(toPlanTaskDto),
        events: eventRows
          .filter((row) => row.attendeeIds.includes(scope.studentId))
          .map((row) => toPlanEventDto(row)),
      }));
    });
  }

  listAggregate(
    organizerUserId: string,
    scopes: CoachPlanScope[],
    range: { from: string; to: string },
  ): Promise<CoachPlanData> {
    return withServiceContext(this.db, async (tx) => {
      const [personalRows, taskRows, eventRows] = await Promise.all([
        this.tasks.listOwnedForCoach(
          tx,
          organizerUserId,
          range.from,
          range.to,
        ),
        this.tasks.listMentorshipTasksForCoach(
          tx,
          scopes,
          range.from,
          range.to,
        ),
        this.events.listOwnedForCoach(
          tx,
          organizerUserId,
          range.from,
          range.to,
        ),
      ]);
      const allowedStudents = new Set(scopes.map((scope) => scope.studentId));
      return {
        personalTasks: personalRows.map(toPlanTaskDto),
        mentorshipTasks: taskRows.flatMap((row) => {
          const scope = scopes.find(
            (candidate) =>
              candidate.studentId === row.userId &&
              candidate.mentorshipLinkId === row.originRefId,
          );
          return scope ? [{ ...scope, task: toPlanTaskDto(row) }] : [];
        }),
        events: eventRows.map((row) => ({
          event: toPlanEventDto(row),
          attendeeIds: row.attendeeIds.filter((id) =>
            allowedStudents.has(id),
          ),
        })),
      };
    });
  }

  getEvent(
    organizerUserId: string,
    eventId: string,
    authorizedStudentIds: string[],
  ): Promise<{ event: PlanEventDto; attendeeIds: string[] }> {
    return withServiceContext(this.db, async (tx) => {
      const row = await this.events.findOwnedById(
        tx,
        organizerUserId,
        eventId,
      );
      if (!row) notFound();
      const allowed = new Set(authorizedStudentIds);
      return {
        event: toPlanEventDto(row!),
        attendeeIds: row!.attendeeIds.filter((id) => allowed.has(id)),
      };
    });
  }
}
