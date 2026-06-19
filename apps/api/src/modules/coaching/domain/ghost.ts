/**
 * Pure "geçmiş-ben" (ghost) comparison — the latest mock-exam attempt measured against the user's
 * OWN past (§0: never vs other users). Framework-free; the service resolves the localized headline
 * from `headlineKey` and attaches the cached AI narration. Net values arrive as strings (numeric
 * column) and are parsed/formatted via `domain/net.ts`.
 */

import { formatNet, formatNetDelta } from "./net";

export interface GhostSubjectScore {
  subjectRef: string;
  net: string;
}

export interface GhostInput {
  latest: { id: string; takenAt: Date; totalNet: string; examName: string };
  /** Immediately prior attempt's total net (caller guarantees a previous attempt exists). */
  previousNet: string;
  /** All-time best total net BEFORE the latest attempt. */
  bestPreviousNet: string;
  latestSubjects: GhostSubjectScore[];
  previousSubjects: GhostSubjectScore[];
  subjectName: (ref: string) => string;
}

export interface GhostSubjectDelta {
  subjectRef: string;
  subjectName: string;
  latestNet: string;
  previousNet: string | null;
  delta: string | null;
}

/** Domain result — `headlineKey` is an i18n key the service resolves; no AI narration here. */
export interface GhostComputation {
  latest: { id: string; takenAt: string; totalNet: string; examName: string };
  previousNet: string;
  previousDelta: string;
  beatPrevious: boolean;
  bestPreviousNet: string;
  recordDelta: string;
  isNewRecord: boolean;
  headlineKey: string;
  subjects: GhostSubjectDelta[];
}

/** Stable i18n keys for the rule-based headline buckets (copy lives in locale files). */
export const GhostHeadlineKey = {
  NEW_RECORD: "coaching.ghost.NEW_RECORD",
  BEAT_PREVIOUS: "coaching.ghost.BEAT_PREVIOUS",
  TIED: "coaching.ghost.TIED",
  BELOW_PREVIOUS: "coaching.ghost.BELOW_PREVIOUS",
} as const;

export function computeGhost(input: GhostInput): GhostComputation {
  const latestNet = Number(input.latest.totalNet);
  const previousNet = Number(input.previousNet);
  const bestPreviousNet = Number(input.bestPreviousNet);

  const previousDeltaNum = latestNet - previousNet;
  const beatPrevious = latestNet > previousNet;
  const isNewRecord = latestNet > bestPreviousNet;

  const headlineKey = isNewRecord
    ? GhostHeadlineKey.NEW_RECORD
    : beatPrevious
      ? GhostHeadlineKey.BEAT_PREVIOUS
      : Math.round(previousDeltaNum * 100) === 0
        ? GhostHeadlineKey.TIED
        : GhostHeadlineKey.BELOW_PREVIOUS;

  const prevByRef = new Map(input.previousSubjects.map((s) => [s.subjectRef, s.net]));
  const subjects: GhostSubjectDelta[] = input.latestSubjects.map((s) => {
    const prev = prevByRef.get(s.subjectRef);
    return {
      subjectRef: s.subjectRef,
      subjectName: input.subjectName(s.subjectRef),
      latestNet: formatNet(Number(s.net)),
      previousNet: prev != null ? formatNet(Number(prev)) : null,
      delta: prev != null ? formatNetDelta(Number(s.net) - Number(prev)) : null,
    };
  });

  return {
    latest: {
      id: input.latest.id,
      takenAt: input.latest.takenAt.toISOString(),
      totalNet: formatNet(latestNet),
      examName: input.latest.examName,
    },
    previousNet: formatNet(previousNet),
    previousDelta: formatNetDelta(previousDeltaNum),
    beatPrevious,
    bestPreviousNet: formatNet(bestPreviousNet),
    recordDelta: formatNetDelta(latestNet - bestPreviousNet),
    isNewRecord,
    headlineKey,
    subjects,
  };
}
