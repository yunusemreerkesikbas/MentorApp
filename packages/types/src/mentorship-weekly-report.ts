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
  | "UNCLASSIFIED_SESSIONS";

export interface MentorshipWeeklyBriefFindingDto {
  observation: string;
  evidenceIds: string[];
  uncertainty: string;
  conversationQuestion: string;
}

export interface MentorshipWeeklyBriefDto {
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
  draftId: string | null;
  studentId: string;
  studentDisplayName: string;
  sourceFingerprint: string;
  status: MentorshipWeeklyReportStatus;
  snapshot: MentorshipWeeklySnapshotDto;
  brief: MentorshipWeeklyBriefDto | null;
}

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
  coachEvaluation: string | null;
}
