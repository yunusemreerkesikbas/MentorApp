import { EventEmitter2 } from "@nestjs/event-emitter";
import type {
  CancelPlanEventInput,
  CreatePlanEventInput,
  UpdatePlanEventInput,
} from "@mentor/validation";
import type { DatabaseTx } from "../../../database/drizzle";
import {
  CoachingEventTopic,
  PlanEventCancelled,
  PlanEventCreated,
  type PlanEventOccurrencePayload,
  PlanEventUpdated,
} from "../domain/coaching.events";
import { todayInIstanbul } from "../domain/date.util";
import {
  PlanEventRepository,
  type PlanEventRecord,
} from "../infrastructure/plan-event.repository";
import { toPlanEventDto } from "./plan-event.mapper";
import {
  assertMutableDate,
  createEventRows,
  invalidScope,
  notFound,
  type PlanEventMutationResult,
  sanitizeAttendees,
  updateEvent,
} from "./plan-event-mutation";
import { generateEventDates } from "./plan-event-recurrence-policy";

export class PlanEventWriteOrchestrator {
  constructor(
    private readonly repository: PlanEventRepository,
    private readonly events: EventEmitter2,
  ) {}

  lockOrganizerInTransaction(
    tx: DatabaseTx,
    organizerUserId: string,
  ): Promise<void> {
    return this.repository.acquireOrganizerLock(tx, organizerUserId);
  }

  async createInTransaction(
    tx: DatabaseTx,
    organizerUserId: string,
    input: CreatePlanEventInput,
  ): Promise<PlanEventMutationResult> {
    assertMutableDate(input.eventDate);
    const attendeeIds = sanitizeAttendees(input.attendeeIds, organizerUserId);
    const dates = input.recurrence
      ? generateEventDates({ ...input.recurrence, startsOn: input.eventDate })
      : [input.eventDate];
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
      dates.map(() => attendeeIds),
      series,
    );
    const occurrences = await this.repository.findOwnedByIds(
      tx,
      organizerUserId,
      rows.map((row) => row.id),
    );
    return {
      dto: toPlanEventDto(rows[0]!, {
        attendeeCount: attendeeIds.length,
        series,
      }),
      occurrences,
    };
  }

  async updateInTransaction(
    tx: DatabaseTx,
    organizerUserId: string,
    eventId: string,
    input: UpdatePlanEventInput,
  ): Promise<PlanEventMutationResult> {
    const existing = await this.requireOwned(tx, organizerUserId, eventId);
    return updateEvent(
      this.repository,
      tx,
      organizerUserId,
      existing,
      input,
    );
  }

  async listAttendeeIdsInTransaction(
    tx: DatabaseTx,
    organizerUserId: string,
    eventId: string,
    scope: UpdatePlanEventInput["scope"],
  ): Promise<string[]> {
    const existing = await this.requireOwned(tx, organizerUserId, eventId);
    if (scope !== "SERIES") return existing.attendeeIds;
    if (!existing.seriesId) invalidScope();
    const occurrences = await this.repository.listFutureSeries(
      tx,
      organizerUserId,
      existing.seriesId!,
      todayInIstanbul(),
    );
    return [...new Set(occurrences.flatMap((row) => row.attendeeIds))];
  }

  async cancelInTransaction(
    tx: DatabaseTx,
    organizerUserId: string,
    eventId: string,
    input: CancelPlanEventInput,
  ): Promise<PlanEventRecord[]> {
    const existing = await this.requireOwned(tx, organizerUserId, eventId);
    if (input.scope === "OCCURRENCE") {
      assertMutableDate(existing.eventDate);
      const cancelled = await this.repository.cancelOccurrence(
        tx,
        organizerUserId,
        eventId,
      );
      if (!cancelled) notFound();
      return [{ ...existing, ...cancelled! }];
    }
    if (!existing.seriesId) invalidScope();
    return this.repository.cancelFutureSeries(
      tx,
      organizerUserId,
      existing.seriesId!,
      todayInIstanbul(),
    );
  }

  publishCreated(organizerUserId: string, result: PlanEventMutationResult) {
    this.events.emit(
      CoachingEventTopic.PLAN_EVENT_CREATED,
      new PlanEventCreated(
        organizerUserId,
        result.occurrences.map((row) => this.payload(row)),
      ),
    );
  }

  publishUpdated(organizerUserId: string, result: PlanEventMutationResult) {
    this.events.emit(
      CoachingEventTopic.PLAN_EVENT_UPDATED,
      new PlanEventUpdated(
        organizerUserId,
        result.occurrences.map((row) => this.payload(row)),
      ),
    );
  }

  publishCancelled(organizerUserId: string, rows: PlanEventRecord[]) {
    this.events.emit(
      CoachingEventTopic.PLAN_EVENT_CANCELLED,
      new PlanEventCancelled(
        organizerUserId,
        rows.map((row) => this.payload(row)),
      ),
    );
  }

  private async requireOwned(
    tx: DatabaseTx,
    organizerUserId: string,
    eventId: string,
  ): Promise<PlanEventRecord> {
    const row = await this.repository.findOwnedById(
      tx,
      organizerUserId,
      eventId,
    );
    if (!row) notFound();
    return row!;
  }

  private payload(row: PlanEventRecord): PlanEventOccurrencePayload {
    return {
      eventId: row.id,
      title: row.title,
      eventDate: row.eventDate,
      startTime: row.startTime?.slice(0, 5) ?? null,
      status: row.status,
      recipientUserIds: row.attendeeIds,
    };
  }
}
