/** Row → API DTO projections (single place so every endpoint returns the same shape). */
import type {
  MoodCheckinDto,
  PlanTaskDto,
  PlanTaskStatus,
  SessionPresetId,
  StudySessionDto,
  StudySessionStatus,
} from "@mentor/types";
import type { MoodCheckinRow } from "../infrastructure/mood-checkin.repository";
import type { PlanTaskRow } from "../infrastructure/plan-task.repository";
import type { StudySessionRow } from "../infrastructure/study-session.repository";

export function toPlanTaskDto(row: PlanTaskRow): PlanTaskDto {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    status: row.status as PlanTaskStatus,
    sortOrder: row.sortOrder,
    taskDate: row.taskDate,
  };
}

export function toStudySessionDto(row: StudySessionRow): StudySessionDto {
  return {
    id: row.id,
    preset: row.preset as SessionPresetId,
    status: row.status as StudySessionStatus,
    subject: row.subject,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    actualFocusSeconds: row.actualFocusSeconds,
  };
}

/** Mood row → DTO. `code`/`message` come from the rule-based mapping resolved in the service. */
export function toMoodCheckinDto(
  row: MoodCheckinRow,
  code: string,
  message: string,
): MoodCheckinDto {
  return {
    checkinDate: row.checkinDate,
    mood: row.mood,
    code,
    message,
  };
}
