import { HttpStatus } from "@nestjs/common";
import type { CreatePlanEventInput, UpdatePlanEventInput } from "@mentor/validation";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { DatabaseTx } from "../../../database/drizzle";
import { todayInIstanbul } from "../domain/date.util";
import type {
  NewPlanEvent,
  PlanEventRecord,
  PlanEventRepository,
  PlanEventSeriesRow,
} from "../infrastructure/plan-event.repository";
import { toPlanEventDto } from "./plan-event.mapper";
import {
  generateEventDates,
  recurrenceFromSeries,
} from "./plan-event-recurrence-policy";

export interface PlanEventMutationResult {
  dto: ReturnType<typeof toPlanEventDto>;
  occurrences: PlanEventRecord[];
}

export function sanitizeAttendees(
  ids: string[],
  organizerUserId: string,
): string[] {
  return [...new Set(ids)].filter((id) => id !== organizerUserId);
}

export async function createEventRows(
  repository: PlanEventRepository,
  tx: DatabaseTx,
  organizerUserId: string,
  input: Pick<
    CreatePlanEventInput,
    "title" | "description" | "startTime" | "endTime"
  >,
  dates: string[],
  attendeeIdsByOccurrence: string[][],
  series: PlanEventSeriesRow | null,
) {
  const rows = await repository.createOccurrences(
    tx,
    dates.map((eventDate, index) => ({
      seriesId: series?.id ?? null,
      organizerUserId,
      orgId: null,
      title: input.title,
      description: input.description ?? null,
      eventDate,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      status: "SCHEDULED" as const,
      attendeeCount: attendeeIdsByOccurrence[index]?.length ?? 0,
    })),
  );
  await repository.addAttendees(
    tx,
    rows.flatMap((row, index) =>
      (attendeeIdsByOccurrence[index] ?? []).map((attendeeUserId) => ({
        eventId: row.id,
        organizerUserId,
        attendeeUserId,
      })),
    ),
  );
  return rows;
}

export async function updateEvent(
  repository: PlanEventRepository,
  tx: DatabaseTx,
  organizerUserId: string,
  existing: PlanEventRecord,
  input: UpdatePlanEventInput,
): Promise<PlanEventMutationResult> {
  if (input.scope === "OCCURRENCE") {
    return updateOccurrence(repository, tx, organizerUserId, existing, input);
  }
  return updateSeries(repository, tx, organizerUserId, existing, input);
}

async function updateOccurrence(
  repository: PlanEventRepository,
  tx: DatabaseTx,
  organizerUserId: string,
  existing: PlanEventRecord,
  input: UpdatePlanEventInput,
): Promise<PlanEventMutationResult> {
  if (input.recurrence !== undefined) invalidScope();
  assertMutableDate(existing.eventDate);
  if (input.eventDate) assertMutableDate(input.eventDate);
  const attendeeIds =
    input.attendeeIds === undefined
      ? existing.attendeeIds
      : sanitizeAttendees(input.attendeeIds, organizerUserId);
  const updated = await repository.updateOccurrence(
    tx,
    organizerUserId,
    existing.id,
    eventPatch(input),
  );
  if (!updated) notFound();
  if (input.attendeeIds !== undefined) {
    await repository.replaceAttendees(
      tx,
      organizerUserId,
      [existing.id],
      attendeeIds,
    );
  }
  return {
    dto: toPlanEventDto(updated!, {
      attendeeCount: attendeeIds.length,
      series: existing.series,
    }),
    occurrences: [
      {
        ...updated!,
        attendeeIds,
        series: existing.series,
      },
    ],
  };
}

async function updateSeries(
  repository: PlanEventRepository,
  tx: DatabaseTx,
  organizerUserId: string,
  existing: PlanEventRecord,
  input: UpdatePlanEventInput,
): Promise<PlanEventMutationResult> {
  if (!existing.seriesId || !existing.series || input.recurrence === null) {
    invalidScope();
  }
  const attendeeIds =
    input.attendeeIds === undefined
      ? existing.attendeeIds
      : sanitizeAttendees(input.attendeeIds, organizerUserId);
  if (input.recurrence !== undefined || input.eventDate !== undefined) {
    return regenerateSeries(
      repository,
      tx,
      organizerUserId,
      existing,
      input,
      attendeeIds,
    );
  }
  const rows = await repository.updateFutureOccurrences(
    tx,
    organizerUserId,
    existing.seriesId!,
    todayInIstanbul(),
    eventPatch(input),
  );
  if (input.attendeeIds !== undefined) {
    await repository.replaceAttendees(
      tx,
      organizerUserId,
      rows.map((row) => row.id),
      attendeeIds,
    );
  }
  const occurrences = await repository.findOwnedByIds(
    tx,
    organizerUserId,
    rows.map((row) => row.id),
  );
  const row =
    occurrences.find((candidate) => candidate.id === existing.id) ??
    occurrences[0];
  if (!row) notFound();
  return {
    dto: toPlanEventDto(row!, {
      attendeeCount: row!.attendeeCount,
      series: row!.series,
    }),
    occurrences,
  };
}

async function regenerateSeries(
  repository: PlanEventRepository,
  tx: DatabaseTx,
  organizerUserId: string,
  existing: PlanEventRecord,
  input: UpdatePlanEventInput,
  attendeeIds: string[],
): Promise<PlanEventMutationResult> {
  const startsOn = input.eventDate ?? existing.series!.startsOn;
  if (input.eventDate !== undefined) assertMutableDate(startsOn);
  const recurrence =
    input.recurrence ?? recurrenceFromSeries(existing.series!);
  const today = todayInIstanbul();
  const dates = generateEventDates({ ...recurrence, startsOn }).filter(
    (date) => date >= today,
  );
  const existingFuture =
    input.attendeeIds === undefined
      ? await repository.listFutureSeries(
          tx,
          organizerUserId,
          existing.seriesId!,
          today,
        )
      : [];
  const attendeeIdsByOccurrence = dates.map(
    (_, index) => existingFuture[index]?.attendeeIds ?? attendeeIds,
  );
  const seriesPatch = {
    frequency: recurrence.frequency,
    startsOn,
    endsOn: recurrence.end.kind === "DATE" ? recurrence.end.date : null,
    occurrenceCount:
      recurrence.end.kind === "COUNT" ? recurrence.end.count : null,
  };
  await repository.updateSeries(
    tx,
    organizerUserId,
    existing.seriesId!,
    seriesPatch,
  );
  await repository.deleteFutureOccurrences(
    tx,
    organizerUserId,
    existing.seriesId!,
    today,
  );
  const series = { ...existing.series!, ...seriesPatch };
  const rows = await createEventRows(
    repository,
    tx,
    organizerUserId,
    { ...existing, ...input },
    dates,
    attendeeIdsByOccurrence,
    series,
  );
  const occurrences = await repository.findOwnedByIds(
    tx,
    organizerUserId,
    rows.map((row) => row.id),
  );
  const row =
    occurrences.find((candidate) => candidate.eventDate === startsOn) ??
    occurrences[0];
  if (!row) notFound();
  return {
    dto: toPlanEventDto(row!, {
      attendeeCount: row!.attendeeCount,
      series,
    }),
    occurrences,
  };
}

function eventPatch(input: UpdatePlanEventInput): Partial<NewPlanEvent> {
  return {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.eventDate !== undefined && { eventDate: input.eventDate }),
    ...(input.startTime !== undefined && { startTime: input.startTime }),
    ...(input.endTime !== undefined && { endTime: input.endTime }),
  };
}

export function assertMutableDate(date: string): void {
  if (date < todayInIstanbul()) {
    throw new DomainError(
      ErrorCode.COACHING_EVENT_DATE_READONLY,
      HttpStatus.FORBIDDEN,
    );
  }
}

export function notFound(): never {
  throw new DomainError(
    ErrorCode.COACHING_EVENT_NOT_FOUND,
    HttpStatus.NOT_FOUND,
  );
}

export function invalidScope(): never {
  throw new DomainError(
    ErrorCode.COACHING_EVENT_SCOPE_INVALID,
    HttpStatus.BAD_REQUEST,
  );
}
