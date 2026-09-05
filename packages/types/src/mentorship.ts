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
  /** Titles, subject/topic labels and statuses — never `plan_tasks.description`. */
  PLAN_TASK_TITLES: "PLAN_TASK_TITLES",
  MOOD_LEVEL: "MOOD_LEVEL",
  /**
   * Which exam the student is preparing for. Profile data rather than behaviour, so it earns its
   * own key: the coach needs it to pick topics from the right taxonomy, and a scope list that
   * omitted it would be describing less than the coach actually receives.
   */
  EXAM_TRACK: "EXAM_TRACK",
  /**
   * The coach may run an AI summary over everything above.
   *
   * It reads no new column — the brief is built from this very list — but the METHOD is new, and
   * "an LLM writes about me for someone else" is not something a student can infer from
   * "my coach sees my activity". Guardrail §4 #5 protects the student's words; this key is what
   * keeps the same honesty about their numbers.
   */
  AI_BRIEF: "AI_BRIEF",
} as const;
export type MentorshipDataScopeKey =
  (typeof MentorshipDataScopeKey)[keyof typeof MentorshipDataScopeKey];

export const MENTORSHIP_DATA_SCOPE: readonly MentorshipDataScopeKey[] = [
  MentorshipDataScopeKey.ACTIVITY,
  MentorshipDataScopeKey.MOCK_EXAMS,
  MentorshipDataScopeKey.PLAN_TASK_TITLES,
  MentorshipDataScopeKey.MOOD_LEVEL,
  MentorshipDataScopeKey.EXAM_TRACK,
  MentorshipDataScopeKey.AI_BRIEF,
];

/**
 * The coach's own landing state: their invite code, how many of their seats are taken, and the
 * mirror of what the student consented to hand over.
 *
 * `dataScope` travels from the API rather than being imported from this package by the coach UI,
 * for the same reason {@link MentorshipInvitationPreviewDto} carries it: the two screens describe
 * one contract, and a client-side copy of the list is a second place for it to drift.
 */
export interface MentorshipCoachOverviewDto {
  /** Null when the coach has never issued one. */
  inviteCode: MentorshipInviteCodeDto | null;
  activeStudents: number;
  /** `mentorship.coach.max_active_students`. Overflow is an error on redemption, not a paywall. */
  maxActiveStudents: number;
  /**
   * How many of this coach's students get sponsored Premium (`mentorship.coach.free_seats`).
   * Distinct from `maxActiveStudents`: that one caps who may be followed, this one caps who is
   * paid for. A coach at 5/20 students with 3 free seats is following five and sponsoring three.
   */
  freeSeats: number;
  /**
   * Extra sponsored seats the coach's own plan adds (`plans.seat_count`). 0 without a seat plan.
   * The allowance is `freeSeats + paidSeats`; past it a student is followed but not sponsored.
   */
  paidSeats: number;
  /**
   * Seats actually in use right now — counted, never inferred from `activeStudents`. A live link
   * does not imply a seat: a student who already pays for themselves is never sponsored, and
   * lowering `freeSeats` leaves existing sponsorships standing.
   */
  usedSeats: number;
  /** False while `mentorship.seats.sponsorship_enabled` is off — then no seat grants anything. */
  sponsorshipEnabled: boolean;
  dataScope: MentorshipDataScopeKey[];
}

/**
 * The coach's standing note to their student. One note, overwritten in place — not a thread:
 * Phase-2 communication stays off-platform and in-app chat is Phase 3 (roadmap §9).
 */
export interface MentorshipCoachNoteDto {
  body: string;
  updatedAt: string;
}

/** The student's view of their own link ("who is my coach, what do they see"). */
export interface MyCoachDto {
  linkId: string;
  coachDisplayName: string;
  coachUsername: string | null;
  status: MentorshipLinkStatus;
  acceptedAt: string | null;
  dataScope: MentorshipDataScopeKey[];
  /** Null when the coach has not left one. Cleared with the link, never inherited by a successor. */
  coachNote: MentorshipCoachNoteDto | null;
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

/**
 * The numbers on a roster row. Separated from the row on purpose: an ENDED link carries `null`
 * here, so "a coach who no longer follows this student sees no data" is enforced by the type
 * rather than remembered by whoever edits the mapper next. Ending a link revokes consent, and
 * revoked consent has to stop the data, not just the badge.
 */
export interface MentorshipRosterMetricsDto {
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
}

/** One roster row: who the student is, how they are doing, what needs attention. */
export interface MentorshipRosterRowDto {
  linkId: string;
  studentId: string;
  studentDisplayName: string;
  studentUsername: string | null;
  status: MentorshipLinkStatus;
  acceptedAt: string | null;
  endedAt: string | null;
  /** Null for an ENDED link — the coach's window onto this student is closed. */
  metrics: MentorshipRosterMetricsDto | null;
  /** Always empty for an ENDED link (no data to triage, and nothing to act on). */
  riskFlags: MentorshipRiskFlagId[];
}

/**
 * One plan row as the coach sees it. Headings and labels only — `plan_tasks.description` is the
 * student's own note and never appears here.
 */
export interface MentorshipReportPlanTaskDto {
  taskDate: string;
  title: string;
  subject: string | null;
  topic: string | null;
  status: string;
  /** True when THIS coach's live link authored the row — the "did they do what I gave them" bit. */
  assignedByCoach: boolean;
  /**
   * The coach's own instruction, read back to them. Null unless `assignedByCoach`: a coach never
   * reads a previous coach's note, even on a task that outlived the link that created it.
   */
  coachNote: string | null;
}

/**
 * A coach-assigned task the student removed. The report otherwise shows only the LIVING plan, so
 * without this a dropped assignment reads as one that was never given.
 */
export interface MentorshipDroppedAssignmentDto {
  /** The day it had been assigned for. */
  taskDate: string;
  title: string;
  droppedAt: string;
}

/** The single-student report. Numbers, dates, statuses and task headings — never free text. */
export interface MentorshipStudentReportDto {
  studentId: string;
  studentDisplayName: string;
  studentUsername: string | null;
  acceptedAt: string | null;
  /** Which exam taxonomy to offer when assigning (scope key `EXAM_TRACK`); null if unset. */
  studentExamType: string | null;
  /** What THIS coach wrote for this student, read back to them. */
  coachNote: MentorshipCoachNoteDto | null;
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
  planTasks: MentorshipReportPlanTaskDto[];
  /** Assigned by THIS coach and since deleted, newest first. Same 14-day window as `planTasks`. */
  droppedAssignments: MentorshipDroppedAssignmentDto[];
  moodTrend: { date: string; level: number }[];
}

/**
 * One task inside a saved program. `dayIndex` is days from the program's own first day (0..20,
 * three weeks — the composer's 21-task ceiling), never a date: a template exists to be re-dated
 * onto whatever week the composer is showing.
 */
export interface MentorshipProgramTemplateTaskDto {
  dayIndex: number;
  title: string;
  subject: string | null;
  topic: string | null;
  coachNote: string | null;
}

/**
 * A week the coach saved to reuse. Loading one fills the composer's drafts; the write still goes
 * through `POST /students/:id/assignments`, so every existing guard (21 ceiling, 120-day horizon,
 * all-or-nothing transaction) applies unchanged and there is no second way to write a plan.
 *
 * `examType` is the taxonomy the topics were picked from, so the composer can say so when the
 * template is loaded onto a student sitting a different exam. Null means the template carries no
 * topics and fits anyone.
 */
export interface MentorshipProgramTemplateDto {
  id: string;
  name: string;
  examType: string | null;
  tasks: MentorshipProgramTemplateTaskDto[];
  updatedAt: string;
}

/**
 * The coach's AI brief over one student's report.
 *
 * Cached on the link row rather than in a table of its own: it is one text per relationship,
 * overwritten in place, exactly like the coach's standing note — and being on the link means KVKK
 * erasure, which deletes links outright, carries it away with no extra clause.
 */
export interface MentorshipBriefDto {
  brief: string;
  /** The model that wrote it, or `"cache"` when the stored one still matches the report. */
  model: string;
  generatedAt: string;
}
