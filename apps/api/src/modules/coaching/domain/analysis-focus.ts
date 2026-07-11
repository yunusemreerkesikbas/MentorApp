import type { PhotoSubjectSignalDto, SubjectStrengthDto } from "@mentor/types";
import { formatNetDelta } from "./net";

export type AnalysisFocus = {
  subjectRef: string;
  subjectName: string;
  source: "PHOTO_SIGNAL" | "LOWEST_AVERAGE";
  evidenceCount: number;
  evidenceLevel: "EARLY" | "REPEATED";
};

function evidenceLevel(count: number): AnalysisFocus["evidenceLevel"] {
  return count === 1 ? "EARLY" : "REPEATED";
}

function normalizedPercent(
  subject: SubjectStrengthDto | undefined,
): number {
  if (subject?.normalizedAveragePercent == null) return Number.POSITIVE_INFINITY;
  return Number(subject.normalizedAveragePercent);
}


export type FocusTrendDirection = "FIRST" | "UP" | "DOWN" | "STEADY";

export function buildFocusTrend(
  subjectRef: string,
  attempts: Array<{ id: string; takenAt: Date }>,
  subjectsByMockExamId: Map<string, Array<{ subjectRef: string; net: string }>>,
) {
  const recentTrend = attempts.flatMap((attempt) => {
    const subject = subjectsByMockExamId
      .get(attempt.id)
      ?.find((row) => row.subjectRef === subjectRef);
    return subject
      ? [{
          mockExamId: attempt.id,
          takenAt: attempt.takenAt.toISOString(),
          net: String(subject.net),
        }]
      : [];
  });
  if (recentTrend.length < 2) {
    return {
      recentTrend,
      recentDelta: null,
      trendDirection: "FIRST" as const,
    };
  }

  const delta = Number(recentTrend[0]!.net) - Number(recentTrend[1]!.net);
  const trendDirection: FocusTrendDirection =
    delta > 0 ? "UP" : delta < 0 ? "DOWN" : "STEADY";
  return {
    recentTrend,
    recentDelta: formatNetDelta(delta),
    trendDirection,
  };
}

export function selectAnalysisFocus(
  subjects: SubjectStrengthDto[],
  photoSignals: PhotoSubjectSignalDto[],
): AnalysisFocus | null {
  const subjectByRef = new Map(subjects.map((subject) => [subject.subjectRef, subject]));

  let selectedPhoto: PhotoSubjectSignalDto | null = null;
  for (const signal of photoSignals) {
    const signalPercent = normalizedPercent(subjectByRef.get(signal.subjectRef));
    const selectedPercent = selectedPhoto
      ? normalizedPercent(subjectByRef.get(selectedPhoto.subjectRef))
      : Number.POSITIVE_INFINITY;

    if (
      selectedPhoto === null ||
      signal.count > selectedPhoto.count ||
      (signal.count === selectedPhoto.count && signalPercent < selectedPercent) ||
      (signal.count === selectedPhoto.count &&
        signalPercent === selectedPercent &&
        signal.subjectRef < selectedPhoto.subjectRef)
    ) {
      selectedPhoto = signal;
    }
  }
  if (selectedPhoto) {
    return {
      subjectRef: selectedPhoto.subjectRef,
      subjectName: selectedPhoto.subjectName,
      source: "PHOTO_SIGNAL",
      evidenceCount: selectedPhoto.count,
      evidenceLevel: evidenceLevel(selectedPhoto.count),
    };
  }

  let selectedSubject: SubjectStrengthDto | null = null;
  for (const subject of subjects) {
    if (subject.normalizedAveragePercent == null) continue;
    if (
      selectedSubject === null ||
      Number(subject.normalizedAveragePercent) <
        Number(selectedSubject.normalizedAveragePercent) ||
      (Number(subject.normalizedAveragePercent) ===
        Number(selectedSubject.normalizedAveragePercent) &&
        subject.subjectRef < selectedSubject.subjectRef)
    ) {
      selectedSubject = subject;
    }
  }
  if (!selectedSubject) return null;

  return {
    subjectRef: selectedSubject.subjectRef,
    subjectName: selectedSubject.subjectName,
    source: "LOWEST_AVERAGE",
    evidenceCount: selectedSubject.attemptCount,
    evidenceLevel: evidenceLevel(selectedSubject.attemptCount),
  };
}

