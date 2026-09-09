import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Paginated, PlanEventDto, PlanTaskDto } from "@mentor/types";
import type {
  CancelPlanEventInput,
  CreatePlanEventInput,
  ListPlanTasksQuery,
  UpdatePlanEventInput,
} from "@mentor/validation";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { PlanEventRepository } from "../infrastructure/plan-event.repository";
import { PlanTaskRepository } from "../infrastructure/plan-task.repository";
import { todayInIstanbul } from "../domain/date.util";
import { toPlanTaskDto } from "./coaching.mappers";
import { toPlanEventDto } from "./plan-event.mapper";
import { notFound, type PlanEventMutationResult } from "./plan-event-mutation";
import { PlanEventWriteOrchestrator } from "./plan-event-write.orchestrator";

export interface CoachPlanScope {
  mentorshipLinkId: string;
  studentId: string;
}

export interface CoachPlanAggregate {
  mentorshipLinkId: string;
  studentId: string;
  tasks: PlanTaskDto[];
  events: PlanEventDto[];
}

export interface CoachPlanData {
  personalTasks: PlanTaskDto[];
  mentorshipTasks: Array<CoachPlanScope & { task: PlanTaskDto }>;
  events: Array<{ event: PlanEventDto; attendeeIds: string[] }>;
}

@Injectable()
export class PlanEventService {
  private readonly writes: PlanEventWriteOrchestrator;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly repository: PlanEventRepository,
    private readonly tasks: PlanTaskRepository,
    events: EventEmitter2,
  ) {
    this.writes = new PlanEventWriteOrchestrator(repository, events);
  }

  async list(
    participantUserId: string,
    query: ListPlanTasksQuery,
  ): Promise<Paginated<PlanEventDto>> {
    const effectiveQuery = {
      ...query,
      date: query.from ? undefined : (query.date ?? todayInIstanbul()),
    };
    return withUserContext(this.db, { userId: participantUserId }, async (tx) => {
      const page = await this.repository.listParticipantPaged(
        tx,
        participantUserId,
        effectiveQuery,
      );
      return {
        items: page.items.map((row) => toPlanEventDto(row)),
        total: page.total,
        page: query.page,
        pageSize: query.pageSize,
      };
    });
  }

  async create(
    organizerUserId: string,
    input: CreatePlanEventInput,
  ): Promise<PlanEventDto> {
    const result = await withUserContext(
      this.db,
      { userId: organizerUserId },
      (tx) => this.createInTransaction(tx, organizerUserId, input),
    );
    this.publishCreated(organizerUserId, result);
    return result.dto;
  }

  createInTransaction(
    tx: DatabaseTx,
    organizerUserId: string,
    input: CreatePlanEventInput,
  ): Promise<PlanEventMutationResult> {
    return this.writes.createInTransaction(tx, organizerUserId, input);
  }

  publishCreated(
    organizerUserId: string,
    result: PlanEventMutationResult,
  ): void {
    this.writes.publishCreated(organizerUserId, result);
  }

  async update(
    organizerUserId: string,
    id: string,
    input: UpdatePlanEventInput,
  ): Promise<PlanEventDto> {
    const result = await withUserContext(
      this.db,
      { userId: organizerUserId },
      (tx) => this.updateInTransaction(tx, organizerUserId, id, input),
    );
    this.publishUpdated(organizerUserId, result);
    return result.dto;
  }

  updateInTransaction(
    tx: DatabaseTx,
    organizerUserId: string,
    eventId: string,
    input: UpdatePlanEventInput,
  ): Promise<PlanEventMutationResult> {
    return this.writes.updateInTransaction(
      tx,
      organizerUserId,
      eventId,
      input,
    );
  }

  publishUpdated(
    organizerUserId: string,
    result: PlanEventMutationResult,
  ): void {
    this.writes.publishUpdated(organizerUserId, result);
  }

  listEventAttendeeIdsInTransaction(
    tx: DatabaseTx,
    organizerUserId: string,
    eventId: string,
    scope: UpdatePlanEventInput["scope"],
  ): Promise<string[]> {
    return this.writes.listAttendeeIdsInTransaction(
      tx,
      organizerUserId,
      eventId,
      scope,
    );
  }

  async cancel(
    organizerUserId: string,
    id: string,
    input: CancelPlanEventInput,
  ): Promise<void> {
    const rows = await withUserContext(
      this.db,
      { userId: organizerUserId },
      (tx) => this.writes.cancelInTransaction(tx, organizerUserId, id, input),
    );
    this.writes.publishCancelled(organizerUserId, rows);
  }

  async listAuthorizedForCoach(
    organizerUserId: string,
    scopes: CoachPlanScope[],
    range: { from: string; to: string },
  ): Promise<CoachPlanAggregate[]> {
    if (scopes.length === 0) return [];
    return withServiceContext(this.db, async (tx) => {
      const studentIds = [...new Set(scopes.map((scope) => scope.studentId))];
      const [eventRows, taskRows] = await Promise.all([
        this.repository.listAuthorizedForCoach(
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

  async listCoachPlanData(
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
        this.repository.listOwnedForCoach(
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
        events: eventRows.map((row) => {
          const attendeeIds = row.attendeeIds.filter((id) =>
            allowedStudents.has(id),
          );
          return { event: toPlanEventDto(row), attendeeIds };
        }),
      };
    });
  }

  async getCoachEventData(
    organizerUserId: string,
    eventId: string,
    authorizedStudentIds: string[],
  ): Promise<{ event: PlanEventDto; attendeeIds: string[] }> {
    return withServiceContext(this.db, async (tx) => {
      const row = await this.repository.findOwnedById(
        tx,
        organizerUserId,
        eventId,
      );
      if (!row) notFound();
      const allowed = new Set(authorizedStudentIds);
      const attendeeIds = row!.attendeeIds.filter((id) => allowed.has(id));
      return {
        event: toPlanEventDto(row!),
        attendeeIds,
      };
    });
  }

  removeFutureAttendee(
    organizerUserId: string,
    studentId: string,
  ): Promise<number> {
    return withServiceContext(this.db, (tx) =>
      this.repository.removeFutureAttendee(
        tx,
        organizerUserId,
        studentId,
        todayInIstanbul(),
      ),
    );
  }

  removeFutureAttendeeInTransaction(
    tx: DatabaseTx,
    organizerUserId: string,
    studentId: string,
  ): Promise<number> {
    return this.repository.removeFutureAttendee(
      tx,
      organizerUserId,
      studentId,
      todayInIstanbul(),
    );
  }
}
