import type { MentorshipRiskFlagId, MentorshipRosterRowDto } from "@mentor/types";
import { todayInIstanbul } from "@/lib/date-time";
import { isAttended } from "../../_components/attention";
import { worstFlag } from "../../_components/flag-order";

/** How many students the round draws before it folds the rest into "+N" (the panel path's 5). */
export const ROUND_WINDOW = 5;

export type RoundNodeState = "done" | "current" | "upcoming";

export interface RoundNode {
  row: MentorshipRosterRowDto;
  state: RoundNodeState;
  /** The flag the node is named by; null on a seen student whose flags are covered. */
  flag: MentorshipRiskFlagId | null;
}

/**
 * - `empty`: no students yet, the round is an invitation.
 * - `waiting`: somebody waits; the ledge opens the next one.
 * - `complete`: everyone who waited today has been seen.
 * - `calm`: nobody waited today at all.
 */
export type CoachRoundKind = "empty" | "waiting" | "complete" | "calm";

export interface CoachRound {
  kind: CoachRoundKind;
  nodes: RoundNode[];
  /** Students seen today, folded before the window. */
  hiddenBefore: number;
  /** Waiting students folded after the window. */
  hiddenAfter: number;
  waiting: number;
  next: MentorshipRosterRowDto | null;
  /** Every waiting student in round order: what "Sıradaki" walks on the report page. */
  order: string[];
  /** Students with focus minutes on today's Istanbul day (the last cell of their strip). */
  studiedToday: number;
}

/** Marked today on the Istanbul calendar, and the mark still counts on the server. */
function seenOn(row: MentorshipRosterRowDto, today: string): boolean {
  return isAttended(row) && todayInIstanbul(new Date(row.attendedAt!)) === today;
}

/**
 * The coach's round (DESIGN.md §6.1, the panel path's anatomy): today's seen students, then the
 * waiting ones in the server's severity order. The window starts one before the next student, the
 * same rule `buildTodayPath` applies to tasks, so the path always shows where the coach is.
 *
 * Waiting is `needsAttention` and nothing else: a stale mark (past its TTL, or overtaken by a new
 * flag) is back in the queue however recent `attendedAt` looks.
 */
export function buildCoachRound(
  rows: readonly MentorshipRosterRowDto[],
  today: string,
): CoachRound {
  const active = rows.filter((row) => row.status === "ACTIVE" && row.metrics !== null);
  const seen = active.filter((row) => seenOn(row, today));
  const waiting = active.filter((row) => row.needsAttention);
  const studiedToday = active.filter(
    (row) => (row.metrics?.dailyFocusMinutes14d.at(-1) ?? 0) > 0,
  ).length;

  const sequence = [...seen, ...waiting];
  const currentIndex = waiting.length > 0 ? seen.length : -1;
  const anchor = currentIndex === -1 ? sequence.length - 1 : currentIndex;
  const start = Math.max(0, Math.min(anchor - 1, sequence.length - ROUND_WINDOW));
  const nodes = sequence.slice(start, start + ROUND_WINDOW).map((row, offset): RoundNode => {
    const index = start + offset;
    return {
      row,
      state: index < seen.length ? "done" : index === currentIndex ? "current" : "upcoming",
      flag: index < seen.length ? null : worstFlag(row.riskFlags),
    };
  });

  return {
    kind:
      active.length === 0
        ? "empty"
        : waiting.length > 0
          ? "waiting"
          : seen.length > 0
            ? "complete"
            : "calm",
    nodes,
    hiddenBefore: start,
    hiddenAfter: sequence.length - start - nodes.length,
    waiting: waiting.length,
    next: waiting[0] ?? null,
    order: waiting.map((row) => row.studentId),
    studiedToday,
  };
}

export interface RosterGroups {
  waiting: MentorshipRosterRowDto[];
  seenToday: MentorshipRosterRowDto[];
  onTrack: MentorshipRosterRowDto[];
}

/**
 * The student list's three groups, from the rows as the server sent them. The shell passes the
 * loaded rows, not the optimistic ones, so a row the coach just marked keeps its place until the
 * next load instead of jumping away under the pointer.
 */
export function groupRoster(
  rows: readonly MentorshipRosterRowDto[],
  today: string,
): RosterGroups {
  const groups: RosterGroups = { waiting: [], seenToday: [], onTrack: [] };
  for (const row of rows) {
    if (row.needsAttention) groups.waiting.push(row);
    else if (seenOn(row, today)) groups.seenToday.push(row);
    else groups.onTrack.push(row);
  }
  return groups;
}
