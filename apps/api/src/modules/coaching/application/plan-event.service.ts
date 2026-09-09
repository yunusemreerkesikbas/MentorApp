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
import {
  CoachingEventTopic,
  PlanEventCancelled,
  PlanEventCreated,
  type PlanEventOccurrencePayload,
  PlanEventUpdated,
} from "../domain/coaching.events";
import {
  PlanEventRepository,
  type PlanEventRecord,
} from "../infrastructure/plan-event.repository";
import { PlanTaskRepository } from "../infrastructure/plan-task.repository";
import { todayInIstanbul } from "../domain/date.util";
import { toPlanTaskDto } from "./coaching.mappers";
import { toPlanEventDto } from "./plan-event.mapper";
import {
  assertMutableDate,
  createEventRows,
  generateEventDates,
  invalidScope,
  notFound,
  sanitizeAttendees,
  updateEvent,
} from "./plan-event-mutation";

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

@Injectable()
export class PlanEventService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly repository: PlanEventRepository,
    private readonly tasks: PlanTaskRepository,
    private readonly events: EventEmitter2,
  ) {}

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
    assertMutableDate(input.eventDate);
    const attendeeIds = sanitizeAttendees(input.attendeeIds, organizerUserId);
    const dates = input.recurrence
      ? generateEventDates({
          ...input.recurrence,
          startsOn: input.eventDate,
        })
      : [input.eventDate];
    const result = await withUserContext(
      this.db,
      { userId: organizerUserId },
      async (tx) => {
        await this.repository.acquireOrganizerLock(tx, organizerUserId);
        const series = input.recurrence
          ? await this.repository.createSeries(tx, {
              organizerUserId,
              orgId: null,
              frequency: input.recurrence.frequency,
              timeZone: "Europe/Istanbul",
              startsOn: input.eventDate,
              endsOn:
                input.recurrence.end.kind === "DATE"
                  ? input.recurrence.end.date
                  : null,
              occurrenceCount:
                input.recurrence.end.kind === "COUNT"
                  ? input.recurrence.end.count
                  : null,
            })
          : null;
        const rows = await createEventRows(
          this.repository,
          tx,
          organizerUserId,
          input,
          dates,
          attendeeIds,
          series,
        );
        return { rows, series };
      },
    );
    this.events.emit(
      CoachingEventTopic.PLAN_EVENT_CREATED,
      new PlanEventCreated(
        organizerUserId,
        result.rows.map((row) => this.toEventPayload(row, attendeeIds)),
      ),
    );
    return toPlanEventDto(result.rows[0]!, {
      attendeeCount: attendeeIds.length,
      series: result.series,
    });
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
        await this.repository.acquireOrganizerLock(tx, organizerUserId);
        const existing = await this.requireOwned(tx, organizerUserId, id);
        return updateEvent(
          this.repository,
          tx,
          organizerUserId,
          existing,
          input,
        );
      },
    );
    this.events.emit(
      CoachingEventTopic.PLAN_EVENT_UPDATED,
      new PlanEventUpdated(
        organizerUserId,
        result.occurrences.map((row) =>
          this.toEventPayload(row, row.attendeeIds),
        ),
      ),
    );
    return result.dto;
  }

  async cancel(
    organizerUserId: string,
    id: string,
    input: CancelPlanEventInput,
  ): Promise<void> {
    const emitted = await withUserContext(
      this.db,
      { userId: organizerUserId },
      async (tx) => {
        await this.repository.acquireOrganizerLock(tx, organizerUserId);
        const existing = await this.requireOwned(tx, organizerUserId, id);
        let occurrences = [existing];
        if (input.scope === "OCCURRENCE") {
          assertMutableDate(existing.eventDate);
          const cancelled = await this.repository.cancelOccurrence(
            tx,
            organizerUserId,
            id,
          );
          if (!cancelled) notFound();
          occurrences = [{ ...existing, ...cancelled! }];
        } else {
          if (!existing.seriesId) invalidScope();
          occurrences = await this.repository.cancelFutureSeries(
            tx,
            organizerUserId,
            existing.seriesId!,
            todayInIstanbul(),
          );
        }
        return occurrences;
      },
    );
    this.events.emit(
      CoachingEventTopic.PLAN_EVENT_CANCELLED,
      new PlanEventCancelled(
        organizerUserId,
        emitted.map((row) => this.toEventPayload(row, row.attendeeIds)),
      ),
    );
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

  private async requireOwned(
    tx: DatabaseTx,
    organizerUserId: string,
    id: string,
  ): Promise<PlanEventRecord> {
    const row = await this.repository.findOwnedById(tx, organizerUserId, id);
    if (!row) notFound();
    return row!;
  }

  private toEventPayload(
    row: Pick<
      PlanEventRecord,
      "id" | "title" | "eventDate" | "startTime"
    >,
    recipientUserIds: string[],
  ): PlanEventOccurrencePayload {
    return {
      eventId: row.id,
      title: row.title,
      eventDate: row.eventDate,
      startTime: row.startTime?.slice(0, 5) ?? null,
      recipientUserIds,
    };
  }
}
