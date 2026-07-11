/** Row → API DTO projections (single place so every endpoint returns the same shape). */
import type {
  MoodCheckinDto,
  MockExamDto,
  MockExamSubjectDto,
  PlanTaskDto,
  PlanTaskStatus,
  SessionPresetId,
  StudySessionDto,
  StudySessionStatus,
  VisionDto,
} from "@mentor/types";
import type { MockExamSubjectRow } from "../infrastructure/mock-exam.repository";
import type { MockExamRow } from "../infrastructure/mock-exam.repository";
import type { MoodCheckinRow } from "../infrastructure/mood-checkin.repository";
import type { PlanTaskRow } from "../infrastructure/plan-task.repository";
import type { StudySessionRow } from "../infrastructure/study-session.repository";
import type { VisionBoardRow } from "../infrastructure/vision-board.repository";
import { qualifiesAsFocusSession } from "../domain/coaching.constants";

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

export function toStudySessionDto(
  row: StudySessionRow,
  minFocusSeconds: number,
  extras?: { planTaskTitle?: string | null; planTaskAutoCompleted?: boolean },
): StudySessionDto {
  const countsAsFocusSession =
    row.status === "COMPLETED" &&
    row.endedAt != null &&
    qualifiesAsFocusSession(row.actualFocusSeconds, minFocusSeconds);

  return {
    id: row.id,
    preset: row.preset as SessionPresetId,
    status: row.status as StudySessionStatus,
    subject: row.subject,
    planTaskId: row.planTaskId ?? null,
    planTaskTitle: extras?.planTaskTitle ?? null,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    actualFocusSeconds: row.actualFocusSeconds,
    plannedFocusMinutes: row.plannedFocusMinutes ?? null,
    sessionMood: row.sessionMood ?? null,
    struggleNote: row.struggleNote ?? null,
    aiReflection: row.aiReflection ?? null,
    countsAsFocusSession,
    planTaskAutoCompleted: extras?.planTaskAutoCompleted ?? false,
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
    struggleNote: row.struggleNote,
    aiReflection: row.aiReflection,
  };
}

/** Vision board row → DTO. No rule-based message; `aiNote` is the premium AI line (null for free). */
export function toVisionDto(row: VisionBoardRow): VisionDto {
  return {
    goalTitle: row.goalTitle,
    targetCity: row.targetCity,
    motivation: row.motivation,
    aiNote: row.aiNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toMockExamSubjectDto(
  row: MockExamSubjectRow,
  subjectName: string,
): MockExamSubjectDto {
  return {
    subjectRef: row.subjectRef,
    subjectName,
    correct: row.correct,
    wrong: row.wrong,
    blank: row.blank,
    net: String(row.net),
  };
}

export function toMockExamDto(
  exam: MockExamRow,
  subjects: MockExamSubjectRow[],
  examName: string,
  slugToName: Map<string, string>,
): MockExamDto {
  return {
    id: exam.id,
    examId: exam.examId,
    examName,
    takenAt: exam.takenAt.toISOString(),
    totalNet: String(exam.totalNet),
    publisherName: exam.publisherName ?? null,
    subjects: subjects.map((s) =>
      toMockExamSubjectDto(s, slugToName.get(s.subjectRef) ?? s.subjectRef),
    ),
  };
}
