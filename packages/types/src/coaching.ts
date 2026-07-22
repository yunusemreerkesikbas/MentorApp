/**
 * Coaching API contracts (W2 daily loop + mood) — shared by api (producer) and
 * web/mobile/panel (consumers). The composite `TodayPanelResponse` is the shape the
 * Panel screen renders in ONE server round-trip (no FE recomputation — §engineering-principles).
 *
 * All values are server-computed and ready to display: the countdown days come from the
 * verified content calendar (guardrail §4 #1), the streak from daily activity, and every
 * user-facing line is backend-localized (no AI on these surfaces — §4 #5).
 */

export type PlanTaskStatus = "PENDING" | "DONE";
export type StudySessionStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
export type SessionPresetId = "25_5" | "50_10" | "custom";

/** Projection of a `plan_tasks` row. */
export interface PlanTaskDto {
  id: string;
  title: string;
  /** Soft-ref to the content subject taxonomy (display name), nullable. */
  subject: string | null;
  status: PlanTaskStatus;
  sortOrder: number;
  taskDate: string; // yyyy-mm-dd
}

export type CoachPlanAdaptationSource = "PLAN" | "MOOD" | "SESSION";
export type CoachPlanAdaptationStatus = "READY" | "NO_CHANGE";

export type CoachPlanAdaptationChangeDto =
  | {
      kind: "MOVE";
      taskId: string;
      title: string;
      subject: string | null;
      fromDate: string;
      toDate: string;
    }
  | {
      kind: "ADD";
      title: string;
      subject: string | null;
      taskDate: string;
    };

/** Premium coach preview; no plan row is written until the user confirms selected changes. */
export interface CoachPlanAdaptationDto {
  status: CoachPlanAdaptationStatus;
  /** Backend-localized calm summary. */
  message: string;
  window: { from: string; to: string };
  /** Opaque snapshot hash used to reject stale confirmations. */
  planRevision: string;
  changes: CoachPlanAdaptationChangeDto[];
  model: string;
}

/** Result of atomically applying a user-selected adaptation preview. */
export interface ApplyPlanAdaptationResultDto {
  moved: PlanTaskDto[];
  added: PlanTaskDto[];
}

/** Distinct calendar dates that have ≥1 plan task (datepicker dots). */
export interface PlanTaskCalendarDto {
  dates: string[];
}

/** Projection of a `study_sessions` row. */
export interface StudySessionDto {
  id: string;
  preset: SessionPresetId;
  status: StudySessionStatus;
  subject: string | null;
  /** Plan task this session was started from; null when not linked. */
  planTaskId: string | null;
  /** Resolved plan task title when listed with join; null when unlinked or on write responses. */
  planTaskTitle: string | null;
  startedAt: string; // ISO datetime
  endedAt: string | null; // ISO datetime
  actualFocusSeconds: number;
  /** Set when `preset === "custom"`; null for fixed Pomodoro presets. */
  plannedFocusMinutes: number | null;
  /** Post-session micro check-in effort/mood 1-3 (😩😐🙂); null until captured. */
  sessionMood: number | null;
  /** Optional post-session "what challenged you" note; null when blank. */
  struggleNote: string | null;
  /** Premium AI session reflection (null until generated / for free tier). */
  aiReflection: string | null;
  /**
   * Cached plan-task suggestion from session reflection ({title, subject}); null when none /
   * free / cleared. Used by W3 session-reflection cache; not shown on history list UI.
   */
  aiSuggestedTask: { title: string; subject: string | null } | null;
  /** True when this finalized session meets the platform min-focus threshold (streak/XP/quests). */
  countsAsFocusSession: boolean;
  /** True when finalize auto-marked the linked plan task DONE (this request only). */
  planTaskAutoCompleted: boolean;
}

/** Streak summary derived server-side from `daily_activity` / `streak_state`. */
export interface StreakSummaryDto {
  currentStreak: number;
  longestStreak: number;
  freezeTokens: number;
}

/**
 * Calm countdown — sourced from the verified exam calendar via the content port
 * (never `users.examDate`). `null` when the user has no exam type set or the
 * calendar has no authoritative date yet (no silent fallback — plan §6 #5).
 */
export interface CountdownDto {
  examType: string;
  examName: string;
  /** Computed server-side; the client only displays it. */
  daysRemaining: number;
  /** Pre-formatted authoritative date for display (Turkish). */
  examDateLabel: string;
  source: string;
  sourceUrl: string;
}

/** Pomodoro presets (plan §3 Slice 2: "25_5" | "50_10"). */
export interface SessionPresetDto {
  id: SessionPresetId;
  label: string;
  focusMinutes: number;
  breakMinutes: number;
}

/** Today's mood check-in + its rule-based encouragement (mood is null if not set today). */
export interface MoodCheckinDto {
  checkinDate: string; // yyyy-mm-dd
  mood: number; // 1..5
  /** Stable machine code for the rule-based bucket (client branches on this, not copy). */
  code: string;
  /** Backend-localized encouraging line (display verbatim). */
  message: string;
  /** Optional user-typed subjective signal ("zorlandığın konu"); never AI-generated. */
  struggleNote: string | null;
  /** Cached premium AI-adaptive reflection for today (premium-only; null for free / not yet generated). */
  aiReflection: string | null;
}

/* ------------------------------- mock exams --------------------------------- */

export interface MockExamSubjectDto {
  subjectRef: string;
  subjectName: string;
  correct: number;
  wrong: number;
  blank: number;
  /** Server-computed net (string transport). */
  net: string;
}

export interface MockExamDto {
  id: string;
  examId: string;
  examName: string;
  takenAt: string;
  totalNet: string;
  /** Optional publisher label (e.g. Brans, Limit). */
  publisherName: string | null;
  subjects: MockExamSubjectDto[];
}

export interface MockExamTrendPointDto {
  id: string;
  takenAt: string;
  totalNet: string;
  examName: string;
}

export interface SubjectStrengthDto {
  subjectRef: string;
  subjectName: string;
  averageNet: string;
  attemptCount: number;
  questionCount: number | null;
  /** Server-computed averageNet / questionCount × 100. */
  normalizedAveragePercent: string | null;
}

/** Foto analizinden gelen ders sinyalleri (zayıflık ipucu; net ortalamasından ayrı). */
export interface PhotoSubjectSignalDto {
  subjectRef: string;
  subjectName: string;
  count: number;
}

export interface PhotoTopicSignalDto {
  subjectRef: string;
  subjectName: string;
  topicRef: string;
  topicName: string;
  count: number;
}

/** Server-selected next study focus from personal analysis evidence. */
export type AnalysisFocusTrendDirection = "FIRST" | "UP" | "DOWN" | "STEADY";

export interface AnalysisFocusTrendPointDto {
  mockExamId: string;
  takenAt: string;
  net: string;
}

export interface AnalysisFocusDto {
  subjectRef: string;
  subjectName: string;
  topicRef?: string;
  topicName?: string;
  source: "PHOTO_SIGNAL" | "LOWEST_AVERAGE";
  evidenceCount: number;
  evidenceLevel: "EARLY" | "REPEATED";
  /** Backend-localized, encouraging explanation of the selected evidence. */
  message: string;
  /** Backend-localized Plan task title prefill. */
  suggestedTaskTitle: string;
  /** Selected subject's latest exam-scoped points, newest first (max 4). */
  recentTrend: AnalysisFocusTrendPointDto[];
  /** Latest minus previous subject net; null until two comparable points exist. */
  recentDelta: string | null;
  trendDirection: AnalysisFocusTrendDirection;
  /** Backend-localized interpretation; clients render it verbatim. */
  trendMessage: string;
}

/** Per-subject "geçmiş-ben" delta: this attempt's subject net vs the previous attempt's. */
export interface GhostSubjectDeltaDto {
  subjectRef: string;
  subjectName: string;
  latestNet: string;
  /** Same subject's net in the immediately prior attempt; `null` if it's a new subject. */
  previousNet: string | null;
  /** Signed delta (`latestNet − previousNet`, e.g. "+3.25"); `null` when there's no previous. */
  delta: string | null;
}

/**
 * "Geçmiş-ben" (ghost) — the latest attempt measured against the user's OWN past (§0 no ranking
 * vs others). `null` until there are ≥2 attempts. Free reads the rule-based comparison; the premium
 * AI narration arrives via `POST /v1/coach/ghost-narration` and is cached in `aiNarration`.
 */
export interface GhostComparisonDto {
  latest: { id: string; takenAt: string; totalNet: string; examName: string };
  /** Immediately prior attempt's total net + signed delta + did-you-beat-it flag. */
  previousNet: string;
  previousDelta: string;
  beatPrevious: boolean;
  /** All-time best total net BEFORE the latest attempt + signed delta + new-record flag. */
  bestPreviousNet: string;
  recordDelta: string;
  isNewRecord: boolean;
  /** Backend-localized encouraging headline (display verbatim). */
  headline: string;
  subjects: GhostSubjectDeltaDto[];
  /** Cached premium AI progress narration (premium-only; null for free / not generated). */
  aiNarration: string | null;
}

/** Personal deneme analysis — no ranking (guardrail §0). */
export interface CoachingAnalysisDto {
  trend: MockExamTrendPointDto[];
  subjects: SubjectStrengthDto[];
  photoSubjectSignals: PhotoSubjectSignalDto[];
  photoTopicSignals: PhotoTopicSignalDto[];
  /** `null` until a mock-exam or photo signal supplies personal evidence. */
  nextFocus: AnalysisFocusDto | null;
  /** All-time best total net across all attempts; null when no attempts. */
  personalRecordNet: string | null;
  /** Latest-vs-own-past comparison; `null` when fewer than 2 attempts. */
  ghost: GhostComparisonDto | null;
}

/** Daily focus goal progress for /study-session; `goalMinutes` null = no goal set. */
export interface FocusGoalDto {
  goalMinutes: number | null;
  /** Sum of today's COMPLETED session focus, rounded to minutes (no min-focus filter). */
  focusMinutesToday: number;
}
export type DailyNextActionKind = "START_TASK" | "ADD_TASK" | "DAY_COMPLETE";

export interface DailyNextActionDto {
  kind: DailyNextActionKind;
  title: string;
  message: string;
  taskId: string | null;
}

/** Composite panel payload — one request → whole daily hub. */
export interface TodayPanelResponse {
  greetingName: string;
  /** Rule-based, backend-localized motivational line (no AI on this surface). */
  motivationalLine: string;
  /** `null` when no exam type / no authoritative date (see CountdownDto). */
  countdown: CountdownDto | null;
  streak: StreakSummaryDto;
  tasks: PlanTaskDto[];
  /** Single rule-based step selected by the backend from today's ordered tasks. */
  nextAction: DailyNextActionDto;
  sessionPresets: SessionPresetDto[];
  /** Today's mood check-in if the user already checked in, else `null`. */
  mood: MoodCheckinDto | null;
  /** Daily focus goal progress (/study-session idle surface). */
  focusGoal: FocusGoalDto;
  /**
   * Anonymous count of users focusing right now (aggregate-only ambience);
   * null when below the server-side visibility threshold.
   */
  focusingNow: number | null;
}

/**
 * Vision/goal board ("hayal/hedef panosu") — one text-based goal anchor per user. `null` when the
 * user hasn't set a goal yet. `aiNote` is the cached premium AI motivation line (premium-only;
 * null for free / not yet generated).
 */
export interface VisionDto {
  goalTitle: string;
  targetCity: string | null;
  motivation: string | null;
  aiNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Completed-week rule-based review (Europe/Istanbul, active exam scoped). */
export type WeeklyReviewStatus = "READY" | "INSUFFICIENT";
export type WeeklyEnergySignal = "LOW" | "MIXED" | "STEADY";
export type WeeklyFocusSource =
  | "REPEATED_PHOTO_SIGNAL"
  | "WEEKLY_DECLINE"
  | "LOWEST_NORMALIZED"
  | "SESSION_RHYTHM";

export interface WeeklyReviewDto {
  period: { startDate: string; endDate: string; timeZone: "Europe/Istanbul" };
  status: WeeklyReviewStatus;
  evidence: { mockExamCount: number; completedSessionCount: number };
  rhythm: {
    completedSessionCount: number;
    focusMinutes: number;
    activeDays: number;
    moodCheckinCount: number;
    energySignal: WeeklyEnergySignal | null;
    message: string;
  };
  performance: {
    mockExamCount: number;
    averageNet: string;
    previousWeekAverageNet: string | null;
    delta: string | null;
    evidenceLevel: "EARLY" | "COMPARABLE";
    message: string;
  } | null;
  focus: {
    source: WeeklyFocusSource;
    subjectRef: string | null;
    subjectName: string | null;
    message: string;
  } | null;
  suggestedTask: { title: string; subject: string | null } | null;
}
