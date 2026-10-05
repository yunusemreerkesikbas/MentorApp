import type {
  MentorshipBriefCoachActionsDto,
  MentorshipBriefDeltaDto,
  MentorshipBriefMetricChangeDto,
  MentorshipRiskFlagId,
  MentorshipStudentReportDto,
} from "@mentor/types";
import { todayInIstanbul } from "../../coaching/domain/date.util";

/**
 * "What has moved since the last time I briefed this coach?"
 *
 * `risk-flags.ts` answers who is struggling and `attention.ts` answers who is still waiting; this
 * answers what CHANGED, which is the thing a brief cannot know on its own. Without it every brief
 * is written from a standing start: the same "still slipping" sentence every week, with no memory
 * of the six tasks the coach assigned in between.
 *
 * Pure and rule-based on purpose, like its two neighbours. The model receives this as INPUT and
 * never produces it, and it never receives the previous brief's prose — a model handed its own last
 * answer agrees with it instead of reading the numbers, which is the same argument
 * `ai/domain/mentorship-brief-prompt.ts` makes about `coachNote`, only worse, because a reading
 * that drifted once would then confirm itself every week.
 *
 * TWO rules run through every field below:
 *
 *   - **Absence of data is not movement.** A metric whose previous or current side is null is
 *     reported as null, never as a fall to zero. This is `risk-flags.ts` refusing to flag a student
 *     who planned nothing, applied to a difference instead of a threshold.
 *   - **Zero is not news.** A metric that landed on exactly the same number is null too. A band
 *     that lists every unchanged figure teaches the coach to stop reading it.
 */

/**
 * What one brief was measured against — the measuring stick for the next one.
 *
 * Structurally the stored `MentorshipBriefSnapshot` in `database/schema.ts`; declared here because
 * the domain layer does not import Drizzle. This one is canonical: the schema copy exists so the
 * jsonb column has a type, and a field added here has to be added there.
 */
export interface BriefSnapshot {
  riskFlags: string[];
  planCompletionRate7d: number | null;
  sessions7d: number;
  focusMinutes7d: number;
  activeDays7d: number;
  latestMockAt: string | null;
  latestNet: number | null;
  moodMean: number | null;
  attendedAt: string | null;
}

/**
 * The counts the service reads out of W8's own tables, handed in rather than fetched here.
 *
 * `attended` is absent: it is derivable from the two snapshots, so asking a caller for it would be
 * asking them to get a comparison right that this file can simply do.
 */
export interface BriefFollowupCounts {
  followupsOpened: number;
  followupsClosed: number;
}

export interface PreviousBrief {
  snapshot: BriefSnapshot;
  generatedAt: string;
}

/** Ratios and means carry two decimals: enough to show movement, not enough to show float noise. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * A movement, or null when there was none to report.
 *
 * Both nullable inputs collapse to null rather than to a change against zero — a student who had
 * no mood check-ins last week and three good ones this week has not "improved by 4.0".
 */
function movement(
  previous: number | null,
  current: number | null,
): MentorshipBriefMetricChangeDto | null {
  if (previous === null || current === null) return null;
  const change = round2(current - previous);
  if (change === 0) return null;
  return { previous: round2(previous), current: round2(current), change };
}

function meanLevel(trend: readonly { level: number }[]): number | null {
  if (trend.length === 0) return null;
  return trend.reduce((total, entry) => total + entry.level, 0) / trend.length;
}

/**
 * Freeze what the next brief will measure against.
 *
 * Deliberately narrower than the evidence the model reads: task titles, the full mock list and the
 * dropped rows are all recomputed from the report next time, and keeping a second copy of a
 * student's week around would store more than any question here needs (§4 KVKK minimisation).
 *
 * `mockTrend` and `moodTrend` both arrive newest-first (`coaching/domain/cohort-evidence.ts`), so
 * index 0 is the latest attempt.
 */
export function buildBriefSnapshot(report: MentorshipStudentReportDto): BriefSnapshot {
  const latestMock = report.mockTrend[0] ?? null;
  const moodMean = meanLevel(report.moodTrend);
  return {
    riskFlags: [...report.riskFlags],
    planCompletionRate7d: report.planCompletionRate7d,
    sessions7d: report.activity.sessions7d,
    focusMinutes7d: report.activity.focusMinutes7d,
    activeDays7d: report.activity.activeDays7d,
    latestMockAt: latestMock?.takenAt ?? null,
    latestNet: latestMock?.totalNet ?? null,
    moodMean: moodMean === null ? null : round2(moodMean),
    attendedAt: report.attendedAt,
  };
}

/**
 * Mocks entered since the previous brief.
 *
 * Counted against the previous brief's newest attempt rather than against a stored count: mocks
 * arrive and never disappear, so "what came after this date" stays true while "how many were in a
 * windowed list" does not. A first brief with no stored date counts nothing — there is no interval
 * yet, and calling the student's whole history "since last time" would be a lie on screen.
 */
export function countMocksSince(
  mockTrend: readonly { takenAt: string }[],
  since: string | null,
): number {
  if (since === null) return 0;
  return mockTrend.filter((mock) => mock.takenAt > since).length;
}

/**
 * Coach-assigned rows the report carries for the days from the previous brief onwards.
 *
 * The boundary is an Istanbul calendar date because `taskDate` is one; comparing it against a UTC
 * slice of the timestamp would move the boundary by a day for any brief written after 21:00 UTC.
 *
 * Bounded by the report's own plan window, which is the point rather than a limitation: the number
 * has to match the list the coach can scroll, and a count reaching past what is on screen would be
 * a figure they cannot check.
 */
export function countAssignments(
  report: MentorshipStudentReportDto,
  previousGeneratedAt: string,
): { scheduled: number; completed: number } {
  const from = todayInIstanbul(new Date(previousGeneratedAt));
  const own = report.planTasks.filter(
    (task) => task.assignedByCoach && task.taskDate >= from,
  );
  return {
    scheduled: own.length,
    completed: own.filter((task) => task.status === "DONE").length,
  };
}

/** Coach-assigned tasks the student removed since the previous brief. */
export function countDroppedSince(
  dropped: readonly { droppedAt: string }[],
  since: string,
): number {
  return dropped.filter((row) => row.droppedAt > since).length;
}

/**
 * The delta one brief is written against.
 *
 * Called only when a previous brief exists. The first brief of a relationship period has no delta
 * at all — not an empty one — because "nothing changed" and "there was nothing to compare" are
 * different statements, and the band renders only the first.
 */
export function buildBriefDelta(
  previous: PreviousBrief,
  report: MentorshipStudentReportDto,
  followups: BriefFollowupCounts,
): MentorshipBriefDeltaDto {
  const current = buildBriefSnapshot(report);
  const before = new Set(previous.snapshot.riskFlags);
  const now = new Set<string>(current.riskFlags);

  const flagsAdded = current.riskFlags.filter(
    (flag) => !before.has(flag),
  ) as MentorshipRiskFlagId[];
  const flagsResolved = previous.snapshot.riskFlags.filter(
    (flag) => !now.has(flag),
  ) as MentorshipRiskFlagId[];

  const assignments = countAssignments(report, previous.generatedAt);
  const coachActions: MentorshipBriefCoachActionsDto = {
    // A mark the previous brief already carried is not an action taken since it.
    attended:
      current.attendedAt !== null &&
      current.attendedAt !== previous.snapshot.attendedAt,
    followupsOpened: followups.followupsOpened,
    followupsClosed: followups.followupsClosed,
    assignmentsScheduled: assignments.scheduled,
    assignmentsCompleted: assignments.completed,
    assignmentsDropped: countDroppedSince(
      report.droppedAssignments,
      previous.generatedAt,
    ),
  };

  const delta = {
    previousGeneratedAt: previous.generatedAt,
    flagsAdded,
    flagsResolved,
    planCompletion: movement(
      previous.snapshot.planCompletionRate7d,
      current.planCompletionRate7d,
    ),
    activeDays7d: movement(previous.snapshot.activeDays7d, current.activeDays7d),
    focusMinutes7d: movement(
      previous.snapshot.focusMinutes7d,
      current.focusMinutes7d,
    ),
    sessions7d: movement(previous.snapshot.sessions7d, current.sessions7d),
    mocksSince: countMocksSince(report.mockTrend, previous.snapshot.latestMockAt),
    net: movement(previous.snapshot.latestNet, current.latestNet),
    moodMean: movement(previous.snapshot.moodMean, current.moodMean),
    coachActions,
  };

  return { ...delta, quiet: isQuiet(delta) };
}

/**
 * Nothing moved and the coach did nothing in between.
 *
 * Reachable even though a fresh brief means the fingerprint changed: the evidence carries things
 * this delta deliberately does not report — a retitled task, a dropped row outside the window — so
 * the honest answer is a sentence saying so, not a band with no chips in it.
 */
function isQuiet(delta: Omit<MentorshipBriefDeltaDto, "quiet">): boolean {
  const actions = delta.coachActions;
  return (
    delta.flagsAdded.length === 0 &&
    delta.flagsResolved.length === 0 &&
    delta.planCompletion === null &&
    delta.activeDays7d === null &&
    delta.focusMinutes7d === null &&
    delta.sessions7d === null &&
    delta.net === null &&
    delta.moodMean === null &&
    delta.mocksSince === 0 &&
    !actions.attended &&
    actions.followupsOpened === 0 &&
    actions.followupsClosed === 0 &&
    actions.assignmentsScheduled === 0 &&
    actions.assignmentsCompleted === 0 &&
    actions.assignmentsDropped === 0
  );
}
