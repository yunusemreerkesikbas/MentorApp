import type { CareerGroup, ExamType, ExamVariant } from "@mentor/types";

/** One "Yolun hazır" row; the screen gives it its icon, well and copy (web `complete-step.tsx`). */
export type ReadyRow =
  | { kind: "exam"; examType: ExamType; examVariant: ExamVariant | null }
  | { kind: "goal"; minutes: number }
  | { kind: "field"; careerGroup: CareerGroup }
  | { kind: "reminder" }
  | { kind: "countdown" };

export function readySummaryRows(s: {
  role: "student" | "coach";
  examType: ExamType | null;
  examVariant: ExamVariant | null;
  dailyGoalMinutes: number | null;
  careerGroup: CareerGroup | null;
  /** True only when the phone really registered for push. */
  reminder: boolean;
}): ReadyRow[] {
  const student = s.role === "student";
  const rows: ReadyRow[] = [];
  if (s.examType) rows.push({ kind: "exam", examType: s.examType, examVariant: s.examType === "KPSS" ? s.examVariant : null });
  if (s.dailyGoalMinutes) rows.push({ kind: "goal", minutes: s.dailyGoalMinutes });
  if (student && s.careerGroup) rows.push({ kind: "field", careerGroup: s.careerGroup });
  if (s.reminder) rows.push({ kind: "reminder" });
  if (student) rows.push({ kind: "countdown" });
  return rows;
}

export type PushPermissionState = "granted" | "denied" | "undetermined" | "unsupported";

/** Puhu's layer shows only when the phone will really ask; a decided permission just moves on. */
export function shouldAskPush(state: PushPermissionState): boolean {
  return state === "undetermined";
}
