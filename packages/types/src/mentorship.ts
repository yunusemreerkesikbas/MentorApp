/**
 * @mentor/types — mentorship (human coach ↔ student), W8.
 *
 * NOT the AI coach. The `coach_*` namespace (coach_messages / coach_profiles / coach_memory,
 * `/v1/coach/*`, NotificationCategory.COACH) belongs to the AI companion; the human coach lives
 * under `mentorship` everywhere. The one exception is the `coach_students` table, which predates
 * this slice and has always meant the human relation (§11).
 *
 * Source: roadmap §9 (roles/panels) + §11 (data model).
 */

/** Coach↔student link lifecycle. Double opt-in: the coach issues a code, the student accepts. */
export const MentorshipLinkStatus = {
  /** Row reserved but not yet accepted (marketplace flow, Phase 3). */
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  ENDED: "ENDED",
} as const;
export type MentorshipLinkStatus =
  (typeof MentorshipLinkStatus)[keyof typeof MentorshipLinkStatus];

/** How the link came to be (§11). MARKETPLACE is Phase 3 — reserved, never written yet. */
export const MentorshipLinkSource = {
  INVITE: "INVITE",
  MARKETPLACE: "MARKETPLACE",
} as const;
export type MentorshipLinkSource =
  (typeof MentorshipLinkSource)[keyof typeof MentorshipLinkSource];

/** The coach's single rotating invite code. */
export interface MentorshipInviteCodeDto {
  code: string;
  expiresAt: string;
}

/**
 * What a student sees BEFORE accepting — the coach's public name plus the exact data scope they
 * are consenting to. KVKK: informed consent, so the scope list is part of the contract, not copy.
 */
export interface MentorshipInvitationPreviewDto {
  coachDisplayName: string;
  coachUsername: string | null;
  /** Stable keys the client renders from the `mentorship` i18n namespace. */
  dataScope: MentorshipDataScopeKey[];
}

/**
 * The complete, closed list of what a coach can ever see (guardrail §4 #5 — AI→teacher trust line).
 * Free text (session/mood notes, mistake notebook, forum, AI chat) is absent by construction.
 */
export const MentorshipDataScopeKey = {
  ACTIVITY: "ACTIVITY",
  MOCK_EXAMS: "MOCK_EXAMS",
  PLAN_TASK_TITLES: "PLAN_TASK_TITLES",
  MOOD_LEVEL: "MOOD_LEVEL",
} as const;
export type MentorshipDataScopeKey =
  (typeof MentorshipDataScopeKey)[keyof typeof MentorshipDataScopeKey];

export const MENTORSHIP_DATA_SCOPE: readonly MentorshipDataScopeKey[] = [
  MentorshipDataScopeKey.ACTIVITY,
  MentorshipDataScopeKey.MOCK_EXAMS,
  MentorshipDataScopeKey.PLAN_TASK_TITLES,
  MentorshipDataScopeKey.MOOD_LEVEL,
];

/** The student's view of their own link ("who is my coach, what do they see"). */
export interface MyCoachDto {
  linkId: string;
  coachDisplayName: string;
  coachUsername: string | null;
  status: MentorshipLinkStatus;
  acceptedAt: string | null;
  dataScope: MentorshipDataScopeKey[];
}

/** Link row as the coach sees it (identity only — metrics arrive with the roster slice). */
export interface MentorshipStudentDto {
  linkId: string;
  studentId: string;
  studentDisplayName: string;
  studentUsername: string | null;
  status: MentorshipLinkStatus;
  acceptedAt: string | null;
}

/**
 * Rule-based triage flags (roadmap §9 "smart brief" — the deterministic first version; the AI layer
 * is a later slice). Ordered worst-first in `MENTORSHIP_RISK_SEVERITY`; the roster sorts by it.
 */
export const MentorshipRiskFlag = {
  /** No completed session and no done task for longer than the configured idle window. */
  INACTIVE: "INACTIVE",
  /** Mean mood check-in over the last week at or below the low-mood ceiling. */
  LOW_MOOD: "LOW_MOOD",
  /** Latest mock net below the mean of the three attempts before it. */
  NET_DROP: "NET_DROP",
  /** Fewer than the floor share of the last week's planned tasks completed. */
  PLAN_SLIPPING: "PLAN_SLIPPING",
} as const;
export type MentorshipRiskFlagId =
  (typeof MentorshipRiskFlag)[keyof typeof MentorshipRiskFlag];

/** One roster row: who the student is, how they are doing, what needs attention. */
export interface MentorshipRosterRowDto {
  linkId: string;
  studentId: string;
  studentDisplayName: string;
  studentUsername: string | null;
  acceptedAt: string | null;
  lastActiveDate: string | null;
  currentStreak: number;
  focusMinutes7d: number;
  sessions7d: number;
  activeDays7d: number;
  /** 0..1; null when the student planned nothing (silence, not failure). */
  planCompletionRate7d: number | null;
  latestMockNet: number | null;
  latestMockAt: string | null;
  moodLevel7dAvg: number | null;
  riskFlags: MentorshipRiskFlagId[];
}

/** The single-student report. Numbers, dates, statuses and task headings — never free text. */
export interface MentorshipStudentReportDto {
  studentId: string;
  studentDisplayName: string;
  studentUsername: string | null;
  acceptedAt: string | null;
  riskFlags: MentorshipRiskFlagId[];
  activity: {
    lastActiveDate: string | null;
    currentStreak: number;
    longestStreak: number;
    sessions7d: number;
    focusMinutes7d: number;
    activeDays7d: number;
    sessions28d: number;
    focusMinutes28d: number;
    activeDays28d: number;
  };
  planCompletionRate7d: number | null;
  mockTrend: { takenAt: string; totalNet: number; publisherName: string | null }[];
  latestMockSubjects: {
    subjectRef: string;
    correct: number;
    wrong: number;
    blank: number;
    net: number;
  }[];
  planTasks: { taskDate: string; title: string; subject: string | null; status: string }[];
  moodTrend: { date: string; level: number }[];
}
