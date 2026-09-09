import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Paginated, PlanEventDto } from "@mentor/types";
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
import { toPlanEventDto } from "./plan-event.mapper";
import type { PlanEventMutationResult } from "./plan-event-mutation";
import {
  type CoachPlanAggregate,
  type CoachPlanData,
  PlanEventCoachQuery,
  type CoachPlanScope,
} from "./plan-event-coach-query";
import { PlanEventWriteOrchestrator } from "./plan-event-write.orchestrator";

@Injectable()
export class PlanEventService {
  private readonly writes: PlanEventWriteOrchestrator;
  private readonly coachQuery: PlanEventCoachQuery;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly repository: PlanEventRepository,
    tasks: PlanTaskRepository,
    events: EventEmitter2,
  ) {
    this.writes = new PlanEventWriteOrchestrator(repository, events);
    this.coachQuery = new PlanEventCoachQuery(db, repository, tasks);
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
      async (tx) => {
        await this.lockOrganizerInTransaction(tx, organizerUserId);
        return this.createInTransaction(tx, organizerUserId, input);
      },
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

  lockOrganizerInTransaction(
    tx: DatabaseTx,
    organizerUserId: string,
  ): Promise<void> {
    return this.writes.lockOrganizerInTransaction(tx, organizerUserId);
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
      async (tx) => {
        await this.lockOrganizerInTransaction(tx, organizerUserId);
        return this.updateInTransaction(tx, organizerUserId, id, input);
      },
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
      async (tx) => {
        await this.lockOrganizerInTransaction(tx, organizerUserId);
        return this.cancelInTransaction(tx, organizerUserId, id, input);
      },
    );
    this.publishCancelled(organizerUserId, rows);
  }

  cancelInTransaction(
    tx: DatabaseTx,
    organizerUserId: string,
    eventId: string,
    input: CancelPlanEventInput,
  ) {
    return this.writes.cancelInTransaction(
      tx,
      organizerUserId,
      eventId,
      input,
    );
  }

  publishCancelled(
    organizerUserId: string,
    rows: Parameters<PlanEventWriteOrchestrator["publishCancelled"]>[1],
  ): void {
    this.writes.publishCancelled(organizerUserId, rows);
  }

  async listAuthorizedForCoach(
    organizerUserId: string,
    scopes: CoachPlanScope[],
    range: { from: string; to: string },
  ): Promise<CoachPlanAggregate[]> {
    return this.coachQuery.listAuthorized(organizerUserId, scopes, range);
  }

  async listCoachPlanData(
    organizerUserId: string,
    scopes: CoachPlanScope[],
    range: { from: string; to: string },
  ): Promise<CoachPlanData> {
    return this.coachQuery.listAggregate(organizerUserId, scopes, range);
  }

  async getCoachEventData(
    organizerUserId: string,
    eventId: string,
    authorizedStudentIds: string[],
  ): Promise<{ event: PlanEventDto; attendeeIds: string[] }> {
    return this.coachQuery.getEvent(
      organizerUserId,
      eventId,
      authorizedStudentIds,
    );
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
