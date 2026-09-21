import type {
  MentorshipWeeklyEvidenceDto,
  MentorshipWeeklySnapshotDto,
} from "@mentor/types";

/** Reuse computed aggregates; never join subjects by guessed display names. */
export function buildMentorshipSubjectEvidence(
  subjects: MentorshipWeeklySnapshotDto["subjects"],
  mocks: MentorshipWeeklySnapshotDto["mocks"],
): MentorshipWeeklyEvidenceDto[] {
  return [
    ...subjects.flatMap((row) =>
      row.subjectRef === null
        ? []
        : [
            {
              id: `subject_focus:${row.subjectRef}`,
              kind: "FOCUS_MINUTES" as const,
              subjectRef: row.subjectRef,
              current: row.currentFocusMinutes,
              previous: row.previousFocusMinutes,
              delta: row.currentFocusMinutes - row.previousFocusMinutes,
            },
          ],
    ),
    ...mocks.subjects.map((row) => ({
      id: `subject_mock:${row.subjectRef}`,
      kind: "MOCK_AVERAGE" as const,
      subjectRef: row.subjectRef,
      current: row.currentAverageNet,
      previous: row.previousAverageNet,
      currentAttemptCount: row.currentAttemptCount,
      previousAttemptCount: row.previousAttemptCount,
      delta:
        row.currentAverageNet === null || row.previousAverageNet === null
          ? null
          : Math.round((row.currentAverageNet - row.previousAverageNet) * 100) /
            100,
    })),
  ];
}

export function buildMentorshipWeeklyEvidence(
  snapshot: Pick<
    MentorshipWeeklySnapshotDto,
    "current" | "previous" | "deltas" | "subjects" | "mocks"
  >,
): MentorshipWeeklyEvidenceDto[] {
  const metrics = [
    ["focus_minutes", "FOCUS_MINUTES", "focusMinutes"],
    ["sessions", "SESSIONS", "sessions"],
    ["active_days", "ACTIVE_DAYS", "activeDays"],
    ["planned_tasks", "PLANNED_TASKS", "plannedTasks"],
    ["completed_tasks", "COMPLETED_TASKS", "completedTasks"],
    ["completion_rate", "COMPLETION_RATE", "completionRate"],
  ] as const;
  return [
    ...metrics.map(([id, kind, key]) => ({
      id,
      kind,
      current: snapshot.current[key],
      previous: snapshot.previous[key],
      delta: snapshot.deltas[key],
    })),
    {
      id: "mock_average",
      kind: "MOCK_AVERAGE",
      current: snapshot.mocks.currentAverageNet,
      previous: snapshot.mocks.previousAverageNet,
      delta:
        snapshot.mocks.currentAverageNet === null ||
        snapshot.mocks.previousAverageNet === null
          ? null
          : snapshot.mocks.currentAverageNet -
            snapshot.mocks.previousAverageNet,
    },
    ...buildMentorshipSubjectEvidence(snapshot.subjects, snapshot.mocks),
  ];
}
