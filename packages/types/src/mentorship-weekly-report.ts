export type MentorshipWeeklyReportStatus =
  | "DRAFT"
  | "BRIEF_PENDING"
  | "BRIEF_READY"
  | "BRIEF_FAILED"
  | "FINALIZED";

export interface MentorshipWeeklyReportPeriodDto {
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
  timeZone: "Europe/Istanbul";
}

export interface MentorshipWeeklyMetricsDto {
  focusMinutes: number;
  sessions: number;
  activeDays: number;
  plannedTasks: number;
  completedTasks: number;
  completionRate: number | null;
  hasRecordedActivity: boolean;
}

export interface MentorshipWeeklyMetricDeltasDto {
  focusMinutes: number;
  sessions: number;
  activeDays: number;
  plannedTasks: number;
  completedTasks: number;
  completionRate: number | null;
}

export interface MentorshipWeeklySubjectDto {
  /** Null means the student left the session uncategorized; the server never guesses. */
  subjectRef: string | null;
  currentFocusMinutes: number;
  currentSessions: number;
  previousFocusMinutes: number;
  previousSessions: number;
}

export interface MentorshipWeeklyMockSubjectDto {
  subjectRef: string;
  currentAverageNet: number | null;
  previousAverageNet: number | null;
  currentAttemptCount: number;
  previousAttemptCount: number;
}

export interface MentorshipWeeklyMockSummaryDto {
  examScopeName: string | null;
  currentAttemptCount: number;
  previousAttemptCount: number;
  currentAverageNet: number | null;
  previousAverageNet: number | null;
  currentPublishers: string[];
  previousPublishers: string[];
  subjects: MentorshipWeeklyMockSubjectDto[];
}

export type MentorshipWeeklyEvidenceKind =
  | "FOCUS_MINUTES"
  | "SESSIONS"
  | "ACTIVE_DAYS"
  | "PLANNED_TASKS"
  | "COMPLETED_TASKS"
  | "COMPLETION_RATE"
  | "MOCK_AVERAGE";

export interface MentorshipWeeklyEvidenceDto {
  id: string;
  subjectRef?: string;
  currentAttemptCount?: number;
  previousAttemptCount?: number;
  kind: MentorshipWeeklyEvidenceKind;
  current: number | null;
  previous: number | null;
  delta: number | null;
}

export type MentorshipWeeklyLimitation =
  | "NO_CURRENT_ACTIVITY"
  | "NO_PREVIOUS_ACTIVITY"
  | "NO_CURRENT_MOCK"
  | "NO_PREVIOUS_MOCK"
  | "MIXED_MOCK_SCOPE"
  | "MOCK_PUBLISHERS_DIFFER"
  | "LIMITED_MOCK_ATTEMPTS"
  | "UNCLASSIFIED_SESSIONS";

export interface MentorshipPreparationObservationDto {
  text: string;
  evidenceIds: string[];
}

export interface MentorshipMeetingPreparationDto {
  version: 1;
  focus: MentorshipPreparationObservationDto;
  progress: MentorshipPreparationObservationDto | null;
  uncertainty: string;
  question: string;
  nextStep: string | null;
}

export interface MentorshipWeeklyBriefFindingDto {
  observation: string;
  evidenceIds: string[];
  uncertainty: string;
  conversationQuestion: string;
}

export interface MentorshipWeeklyBriefDto {
  preparation?: MentorshipMeetingPreparationDto;
  coachContext?: string | null;
  findings: MentorshipWeeklyBriefFindingDto[];
  model: string;
  generatedAt: string;
  locale: "tr" | "en";
  promptVersion: string;
}

export interface MentorshipWeeklySnapshotDto {
  period: MentorshipWeeklyReportPeriodDto;
  current: MentorshipWeeklyMetricsDto;
  previous: MentorshipWeeklyMetricsDto;
  deltas: MentorshipWeeklyMetricDeltasDto;
  subjects: MentorshipWeeklySubjectDto[];
  mocks: MentorshipWeeklyMockSummaryDto;
  evidence: MentorshipWeeklyEvidenceDto[];
  limitations: MentorshipWeeklyLimitation[];
}

export interface MentorshipWeeklyReportPreviewDto {
  /** Context of the current preparation request; never part of the share DTO. */
  coachContext?: string | null;
  briefFingerprint?: string | null;
  briefGenerationId?: string | null;
  draftId: string | null;
  studentId: string;
  studentDisplayName: string;
  sourceFingerprint: string;
  status: MentorshipWeeklyReportStatus;
  snapshot: MentorshipWeeklySnapshotDto;
  subjectNames: MentorshipWeeklySubjectNamesDto;
  brief: MentorshipWeeklyBriefDto | null;
}

/**
 * Display names for the subject slugs in `snapshot`, resolved when the report is read. Kept beside
 * the snapshot, never inside it: `sourceFingerprint` hashes the snapshot, and a renamed subject
 * must not turn a stored week into a different one. A slug without an entry renders as itself.
 */
export type MentorshipWeeklySubjectNamesDto = Record<string, string>;

export interface MentorshipWeeklyReportListItemDto {
  id: string;
  locale: "tr" | "en";
  period: MentorshipWeeklyReportPeriodDto;
  version: number;
  finalizedAt: string;
  replacesId: string | null;
}

export interface MentorshipWeeklyReportDto extends MentorshipWeeklyReportListItemDto {
  studentId: string;
  studentDisplayName: string;
  sourceFingerprint: string;
  snapshot: MentorshipWeeklySnapshotDto;
  subjectNames: MentorshipWeeklySubjectNamesDto;
  coachEvaluation: string | null;
  brief: MentorshipWeeklyBriefDto | null;
}

/** Separate safe projection used by the printable student-facing route. */
export interface MentorshipWeeklyReportShareDto {
  id: string;
  locale: "tr" | "en";
  studentDisplayName: string;
  coachDisplayName: string;
  period: MentorshipWeeklyReportPeriodDto;
  version: number;
  finalizedAt: string;
  snapshot: Omit<MentorshipWeeklySnapshotDto, "evidence">;
  subjectNames: MentorshipWeeklySubjectNamesDto;
  coachEvaluation: string | null;
}
