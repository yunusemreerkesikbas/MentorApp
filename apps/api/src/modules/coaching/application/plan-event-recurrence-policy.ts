import { HttpStatus } from "@nestjs/common";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import {
  generatePlanEventDates,
  PlanEventRecurrenceError,
  type PlanEventRecurrenceRule,
} from "../domain/plan-event-recurrence";
import type { PlanEventSeriesRow } from "../infrastructure/plan-event.repository";

export function generateEventDates(rule: PlanEventRecurrenceRule): string[] {
  try {
    return generatePlanEventDates(rule);
  } catch (error) {
    if (error instanceof PlanEventRecurrenceError) {
      throw new DomainError(
        error.reason === "TOO_LONG" ||
          error.reason === "TOO_MANY_OCCURRENCES"
          ? ErrorCode.COACHING_EVENT_RECURRENCE_LIMIT
          : ErrorCode.COACHING_EVENT_RECURRENCE_INVALID,
        HttpStatus.BAD_REQUEST,
      );
    }
    throw error;
  }
}

export function recurrenceFromSeries(series: PlanEventSeriesRow) {
  return {
    frequency: series.frequency,
    end: series.endsOn
      ? ({ kind: "DATE", date: series.endsOn } as const)
      : ({ kind: "COUNT", count: series.occurrenceCount! } as const),
  };
}
