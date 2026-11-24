import type {
  MentorshipCoachOverviewDto,
  MentorshipCoachRegistrationStateDto,
  MentorshipDataScopeKey,
  MentorshipProgramTemplateDto,
  MentorshipProgramTemplateTaskDto,
  MentorshipRosterRowDto,
  MentorshipSharedDataDto,
  MentorshipWeeklyReportShareDto,
} from "@mentor/types";

export type SeatCardState =
  | { kind: "loading" }
  | { kind: "closed" }
  | { kind: "locked"; lock: "STANDING" }
  | {
      kind: "full";
      used: number;
      total: number;
      reason: "seats" | "cap";
      limit: number;
      plansOnSale: boolean;
      sponsored: boolean;
      waiting: number;
    }
  | {
      kind: "open";
      used: number;
      total: number;
      freeSeats: number;
      paidSeats: number;
      sponsored: boolean;
      waiting: number;
    };

export type InviteLock = "EMAIL" | "PHONE" | "STANDING" | null;

export function resolveInviteLock(
  state: MentorshipCoachRegistrationStateDto | null,
): InviteLock {
  const reason = state?.inviteBlockedReason ?? null;
  if (reason === null) return null;
  const map: Record<NonNullable<typeof reason>, Exclude<InviteLock, null>> = {
    EMAIL_UNVERIFIED: "EMAIL",
    PHONE_UNVERIFIED: "PHONE",
    NOT_ACTIVE: "STANDING",
  };
  return map[reason];
}

export function computeSeatCardState(
  overview: MentorshipCoachOverviewDto | null,
  registrationState: MentorshipCoachRegistrationStateDto | null,
): SeatCardState {
  if (overview === null) return { kind: "loading" };
  if (overview.seatAllowance === 0) return { kind: "closed" };
  const lock = resolveInviteLock(registrationState);
  const used = overview.usedSeats;
  const total = overview.seatAllowance;
  const capReached = overview.activeStudents >= overview.maxActiveStudents;
  if (used >= total || capReached) {
    return {
      kind: "full",
      used,
      total,
      reason:
        capReached ||
        overview.freeSeats + overview.paidSeats >= overview.maxActiveStudents
          ? "cap"
          : "seats",
      limit: overview.maxActiveStudents,
      plansOnSale: overview.seatPlansOnSale,
      sponsored: overview.sponsorshipEnabled,
      waiting: overview.waitingStudents,
    };
  }
  if (lock === "STANDING" && overview.inviteCode === null) {
    return { kind: "locked", lock };
  }
  return {
    kind: "open",
    used,
    total,
    freeSeats: overview.freeSeats,
    paidSeats: overview.paidSeats,
    sponsored: overview.sponsorshipEnabled,
    waiting: overview.waitingStudents,
  };
}

export interface ScopeValueLabels {
  activityValue: (args: {
    days: number;
    sessions: number;
    minutes: number;
    activeDays: number;
    streak: number;
  }) => string;
  mockExamsValue: (args: { count: number; date: string }) => string;
  planTitlesValue: (args: { count: number; days: number }) => string;
  planRateValue: (args: { percent: number }) => string;
  moodValue: (args: { count: number; days: number; average: string }) => string;
}

/**
 * Formats live server-computed metrics for the student's "What travels to my coach" mirror.
 * Returns `null` for `AI_BRIEF` (method, not data) or empty buckets.
 */
export function formatScopeValue(
  key: MentorshipDataScopeKey,
  values: MentorshipSharedDataDto,
  labels: ScopeValueLabels,
  locale: string,
): string | null {
  const loc = locale === "en" ? "en-GB" : "tr-TR";
  switch (key) {
    case "ACTIVITY": {
      const a = values.activity;
      if (!a) return null;
      return labels.activityValue({
        days: a.windowDays,
        sessions: a.sessions7d,
        minutes: a.focusMinutes7d,
        activeDays: a.activeDays7d,
        streak: a.currentStreak,
      });
    }
    case "MOCK_EXAMS": {
      const m = values.mockExams;
      if (!m) return null;
      const date = new Intl.DateTimeFormat(loc, {
        day: "numeric",
        month: "long",
      }).format(new Date(m.latestAt));
      return labels.mockExamsValue({ count: m.count, date });
    }
    case "PLAN_TASK_TITLES": {
      const p = values.planTasks;
      if (!p) return null;
      const titles = labels.planTitlesValue({
        count: p.titleCount,
        days: p.titleWindowDays,
      });
      if (p.planCompletionRate7d === null) return titles;
      return `${titles} ${labels.planRateValue({
        percent: Math.round(p.planCompletionRate7d * 100),
      })}`;
    }
    case "MOOD_LEVEL": {
      const mood = values.mood;
      if (!mood) return null;
      return labels.moodValue({
        count: mood.count,
        days: mood.windowDays,
        average: mood.average.toLocaleString(loc, { maximumFractionDigits: 1 }),
      });
    }
    case "EXAM_TRACK":
      return values.examType;
    default:
      return null;
  }
}

export interface CoachRoundBuckets {
  needsAttention: MentorshipRosterRowDto[];
  waitingSeat: MentorshipRosterRowDto[];
  steady: MentorshipRosterRowDto[];
}

export function buildCoachRoundBuckets(
  rows: readonly MentorshipRosterRowDto[],
): CoachRoundBuckets {
  const needsAttention: MentorshipRosterRowDto[] = [];
  const waitingSeat: MentorshipRosterRowDto[] = [];
  const steady: MentorshipRosterRowDto[] = [];
  for (const row of rows) {
    if (row.seat === "NONE") {
      waitingSeat.push(row);
    } else if (row.needsAttention) {
      needsAttention.push(row);
    } else {
      steady.push(row);
    }
  }
  return { needsAttention, waitingSeat, steady };
}

export interface DatedAssignmentDraft {
  title: string;
  subject: string | null;
  topic: string | null;
  coachNote: string | null;
  taskDate: string;
}

export interface TemplateLoadResult {
  drafts: DatedAssignmentDraft[];
  skipped: number;
  clearedTopics: number;
}

function addDaysIso(iso: string, days: number): string {
  const ms = Date.parse(`${iso}T12:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function daysBetweenIso(from: string, to: string): number {
  return Math.max(
    0,
    Math.min(
      20,
      Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000),
    ),
  );
}

export function toTemplateTasks(
  drafts: readonly DatedAssignmentDraft[],
): MentorshipProgramTemplateTaskDto[] {
  if (drafts.length === 0) return [];
  const first = drafts.reduce(
    (min, item) => (item.taskDate < min ? item.taskDate : min),
    drafts[0]!.taskDate,
  );
  return drafts
    .map((draft) => ({
      dayIndex: daysBetweenIso(first, draft.taskDate),
      title: draft.title,
      subject: draft.subject ?? null,
      topic: draft.topic ?? null,
      coachNote: draft.coachNote ?? null,
    }))
    .sort((a, b) => a.dayIndex - b.dayIndex);
}

export function buildTemplateDrafts(
  template: Pick<MentorshipProgramTemplateDto, "examType" | "tasks">,
  anchorIso: string,
  studentExamType: string | null,
  capacity: number,
  bounds?: { minDate: string; maxDate: string },
): TemplateLoadResult {
  if (capacity <= 0) {
    return { drafts: [], skipped: template.tasks.length, clearedTopics: 0 };
  }
  const examMismatch =
    template.examType !== null && template.examType !== studentExamType;
  const taken = [...template.tasks]
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .slice(0, capacity);

  let clearedTopics = 0;
  const drafts: DatedAssignmentDraft[] = [];
  for (const task of taken) {
    let taskDate = addDaysIso(anchorIso, task.dayIndex);
    if (bounds) {
      if (taskDate < bounds.minDate) taskDate = bounds.minDate;
      if (taskDate > bounds.maxDate) continue;
    }
    const dropTopic = examMismatch && task.topic !== null;
    if (dropTopic) clearedTopics += 1;
    drafts.push({
      title: task.title,
      subject: task.subject,
      topic: dropTopic ? null : task.topic,
      coachNote: task.coachNote,
      taskDate,
    });
  }
  return {
    drafts,
    skipped: template.tasks.length - drafts.length,
    clearedTopics,
  };
}

export interface WeeklyReportShareLabels {
  header: (args: { student: string; coach: string; period: string }) => string;
  focusLine: (args: { current: number; previous: number }) => string;
  activeDaysLine: (args: { current: number; previous: number }) => string;
  tasksLine: (args: { done: number; planned: number }) => string;
  mockLine: (args: { current: string; previous: string }) => string;
  evaluationHeading: string;
}

/**
 * Builds plain text for native share from `MentorshipWeeklyReportShareDto`.
 * Uses ONLY the safe student-share contract (no private coach AI brief or evidence).
 */
export function formatWeeklyReportShareText(
  share: MentorshipWeeklyReportShareDto,
  labels: WeeklyReportShareLabels,
  locale: string,
): string {
  const loc = locale === "en" ? "en-GB" : "tr-TR";
  const fmt = new Intl.DateTimeFormat(loc, { day: "numeric", month: "long" });
  const period = `${fmt.format(new Date(`${share.period.startDate}T12:00:00Z`))} - ${fmt.format(
    new Date(`${share.period.endDate}T12:00:00Z`),
  )}`;
  const { current, previous, mocks } = share.snapshot;
  const lines = [
    labels.header({
      student: share.studentDisplayName,
      coach: share.coachDisplayName,
      period,
    }),
    labels.focusLine({
      current: current.focusMinutes,
      previous: previous.focusMinutes,
    }),
    labels.activeDaysLine({
      current: current.activeDays,
      previous: previous.activeDays,
    }),
    labels.tasksLine({
      done: current.completedTasks,
      planned: current.plannedTasks,
    }),
  ];
  if (mocks.currentAverageNet !== null || mocks.previousAverageNet !== null) {
    lines.push(
      labels.mockLine({
        current:
          mocks.currentAverageNet === null ? "-" : String(mocks.currentAverageNet),
        previous:
          mocks.previousAverageNet === null ? "-" : String(mocks.previousAverageNet),
      }),
    );
  }
  if (share.coachEvaluation) {
    lines.push("", `${labels.evaluationHeading}:`, share.coachEvaluation);
  }
  return lines.join("\n");
}

export function parseInviteCodeFromInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/MENTOR-KOC-[0-9A-Za-z]+/i);
  if (match) return match[0].toUpperCase();
  return trimmed.toUpperCase();
}

export function extractMentorshipError(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const record = error as { name?: unknown; body?: { message?: unknown }; message?: unknown };
    if (
      record.name === "ApiClientError" &&
      typeof record.body?.message === "string" &&
      record.body.message.trim().length > 0
    ) {
      return record.body.message;
    }
    if (
      error instanceof Error &&
      record.message &&
      typeof record.message === "string" &&
      record.message.trim().length > 0 &&
      !record.message.includes("http")
    ) {
      return record.message;
    }
  }
  return fallback;
}
