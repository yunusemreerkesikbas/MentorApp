import type { PlanEventDto } from "@mentor/types";
import type {
  PlanEventRecord,
  PlanEventRow,
  PlanEventSeriesRow,
} from "../infrastructure/plan-event.repository";

function toHhmm(value: string | null | undefined): string | null {
  return value ? value.slice(0, 5) : null;
}

export function toPlanEventDto(
  row: PlanEventRecord | PlanEventRow,
  details?: {
    attendeeCount?: number;
    series?: PlanEventSeriesRow | null;
  },
): PlanEventDto {
  const series =
    details?.series ?? ("series" in row ? row.series : null);
  return {
    id: row.id,
    seriesId: row.seriesId,
    organizerUserId: row.organizerUserId,
    orgId: row.orgId,
    title: row.title,
    description: row.description,
    eventDate: row.eventDate,
    startTime: toHhmm(row.startTime),
    endTime: toHhmm(row.endTime),
    status: row.status,
    attendeeCount: details?.attendeeCount ?? row.attendeeCount,
    recurrence: series
      ? {
          frequency: series.frequency,
          timeZone: "Europe/Istanbul",
          startsOn: series.startsOn,
          end: series.endsOn
            ? { kind: "DATE", date: series.endsOn }
            : { kind: "COUNT", count: series.occurrenceCount! },
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
