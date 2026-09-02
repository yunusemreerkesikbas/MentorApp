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
