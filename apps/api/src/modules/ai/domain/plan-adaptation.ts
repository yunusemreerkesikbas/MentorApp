import type {
  CoachPlanAdaptationChangeDto,
  CoachPlanAdaptationSource,
} from "@mentor/types";
import type { PlanAdaptationSnapshotTask } from "../../coaching/domain/plan-adaptation";
import {
  promptLanguageInstruction,
  type PromptLocale,
} from "./prompt-locale";

export interface PromptPlanTask extends PlanAdaptationSnapshotTask {
  ref: string;
}

export type PlanAdaptationParseResult =
  | { kind: "MALFORMED" }
  | { kind: "VALID"; changes: CoachPlanAdaptationChangeDto[] };

const MAX_PENDING_PER_DAY = 3;
const TITLE_MAX = 200;
const SUBJECT_MAX = 80;
export const PLAN_ADAPTATION_MAX_PROMPT_TASKS = 21;

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function normalizedTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

function isWindowDate(date: string, start: string, end: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < start || date > end) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

/** Parse and clamp provider JSON. Invalid individual changes are dropped; invalid JSON is distinct. */
export function parsePlanAdaptation(
  text: string,
  todayIso: string,
  source: CoachPlanAdaptationSource,
  tasks: readonly PromptPlanTask[],
  capacityTasks: readonly PlanAdaptationSnapshotTask[] = tasks,
): PlanAdaptationParseResult {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return { kind: "MALFORMED" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return { kind: "MALFORMED" };
  }
  const rawChanges = (parsed as { changes?: unknown }).changes;
  if (!Array.isArray(rawChanges)) return { kind: "MALFORMED" };

  const windowEnd = addDays(todayIso, 6);
  const byRef = new Map(
    tasks
      .filter((task) => task.status === "PENDING")
      .map((task) => [task.ref, task]),
  );
  const maxMoves = source === "PLAN" ? 3 : 2;
  const maxAdds = source === "PLAN" ? 3 : source === "SESSION" ? 1 : 0;
  const maxTotal = source === "PLAN" ? 5 : source === "SESSION" ? 3 : 2;

  const seenMoveIds = new Set<string>();
  const moveCandidates: Array<
    Extract<CoachPlanAdaptationChangeDto, { kind: "MOVE" }>
  > = [];
  for (const raw of rawChanges) {
    if (moveCandidates.length >= maxMoves) break;
    if ((raw as { kind?: unknown }).kind !== "MOVE") continue;
    const taskRef = (raw as { taskRef?: unknown }).taskRef;
    const toDate = (raw as { toDate?: unknown }).toDate;
    if (typeof taskRef !== "string" || typeof toDate !== "string") continue;
    const task = byRef.get(taskRef);
    if (
      !task ||
      seenMoveIds.has(task.id) ||
      !isWindowDate(toDate, todayIso, windowEnd) ||
      toDate === task.taskDate ||
      (source === "MOOD" && (task.taskDate !== todayIso || toDate <= todayIso))
    ) {
      continue;
    }
    seenMoveIds.add(task.id);
    moveCandidates.push({
      kind: "MOVE",
      taskId: task.id,
      title: task.title,
      subject: task.subject,
      fromDate: task.taskDate,
      toDate,
    });
  }

  const initialPendingByDate = new Map<string, number>();
  const initialTitleCounts = new Map<string, number>();
  const adjustCount = (counts: Map<string, number>, key: string, delta: number) => {
    const next = (counts.get(key) ?? 0) + delta;
    if (next <= 0) counts.delete(key);
    else counts.set(key, next);
  };
  for (const task of capacityTasks) {
    if (task.status === "PENDING") {
      initialPendingByDate.set(
        task.taskDate,
        (initialPendingByDate.get(task.taskDate) ?? 0) + 1,
      );
      adjustCount(
        initialTitleCounts,
        `${task.taskDate}:${normalizedTitle(task.title)}`,
        1,
      );
    }
  }

  let moves: typeof moveCandidates = [];
  let pendingByDate = initialPendingByDate;
  let titleCounts = initialTitleCounts;
  // At most three candidates: choose the largest subset whose final state is valid.
  for (let mask = 1; mask < 1 << moveCandidates.length; mask += 1) {
    const selected = moveCandidates.filter((_, index) => (mask & (1 << index)) !== 0);
    if (selected.length <= moves.length) continue;
    const nextPending = new Map(initialPendingByDate);
    const nextTitles = new Map(initialTitleCounts);
    for (const move of selected) {
      adjustCount(nextPending, move.fromDate, -1);
      adjustCount(nextTitles, `${move.fromDate}:${normalizedTitle(move.title)}`, -1);
    }
    let valid = true;
    for (const move of selected) {
      const targetTitleKey = `${move.toDate}:${normalizedTitle(move.title)}`;
      if (
        (nextPending.get(move.toDate) ?? 0) >= MAX_PENDING_PER_DAY ||
        (nextTitles.get(targetTitleKey) ?? 0) > 0
      ) {
        valid = false;
        break;
      }
      adjustCount(nextPending, move.toDate, 1);
      adjustCount(nextTitles, targetTitleKey, 1);
    }
    if (valid) {
      moves = selected;
      pendingByDate = nextPending;
      titleCounts = nextTitles;
    }
  }

  const additions: Array<
    Extract<CoachPlanAdaptationChangeDto, { kind: "ADD" }>
  > = [];
  for (const raw of rawChanges) {
    if (
      additions.length >= maxAdds ||
      moves.length + additions.length >= maxTotal
    )
      break;
    if ((raw as { kind?: unknown }).kind !== "ADD") continue;
    const rawTitle = (raw as { title?: unknown }).title;
    const taskDate = (raw as { taskDate?: unknown }).taskDate;
    if (typeof rawTitle !== "string" || typeof taskDate !== "string") continue;
    const title = rawTitle.trim().replace(/\s+/g, " ").slice(0, TITLE_MAX);
    if (
      !title ||
      !isWindowDate(taskDate, todayIso, windowEnd) ||
      (source === "SESSION" && taskDate <= todayIso) ||
      (pendingByDate.get(taskDate) ?? 0) >= MAX_PENDING_PER_DAY
    ) {
      continue;
    }
    const key = `${taskDate}:${normalizedTitle(title)}`;
    if ((titleCounts.get(key) ?? 0) > 0) continue;
    const rawSubject = (raw as { subject?: unknown }).subject;
    const subject =
      typeof rawSubject === "string" && rawSubject.trim()
        ? rawSubject.trim().slice(0, SUBJECT_MAX)
        : null;
    adjustCount(titleCounts, key, 1);
    pendingByDate.set(taskDate, (pendingByDate.get(taskDate) ?? 0) + 1);
    additions.push({ kind: "ADD", title, subject, taskDate });
  }

  return { kind: "VALID", changes: [...moves, ...additions] };
}

export const PLAN_ADAPTATION_JSON_SENTINEL =
  "YALNIZ PLAN_ADAPTATION_JSON döndür";

export function buildPlanAdaptationPrompt(input: {
  source: CoachPlanAdaptationSource;
  todayIso: string;
  examType: string | null;
  recentSummary: {
    count7d: number;
    focusMinutes7d: number;
    subjects: string[];
  } | null;
  tasks: readonly PromptPlanTask[];
  note?: string;
  locale?: PromptLocale;
}): { system: string; user: string } {
  const policy =
    input.source === "PLAN"
      ? "En fazla 3 MOVE, 3 ADD ve toplam 5 değişiklik öner."
      : input.source === "MOOD"
        ? "Yalnız bugünkü görevlerden en fazla 2 MOVE öner; ADD önerme."
        : "En fazla 2 MOVE ve sonraki günlere 1 küçük tekrar ADD öner.";
  const contextSignal =
    input.source === "MOOD"
      ? "Düşük enerji sinyali backend tarafından doğrulandı."
      : input.source === "SESSION"
        ? "Zor geçen tamamlanmış seans backend tarafından doğrulandı."
        : "Kullanıcı plan ekranından açıkça uyarlama istedi.";
  const system = [
    promptLanguageInstruction(input.locale ?? "tr"),
    "Sen sınav çalışma planını sadeleştiren bir koçsun. Yalnız önizleme üret; hiçbir görevi silme veya tamamlama.",
    `Bugün ${input.todayIso}; hedef tarihler bugün dahil 7 günlük pencere içinde olmalı.`,
    policy,
    "MOVE için yalnız verilen T referanslarını kullan. Aynı güne taşıma yapma. Bir günde en fazla 3 görev olsun.",
    "ADD görevleri küçük, somut ve kısa olsun; mevcut görevin aynı adlı kopyasını ekleme.",
    `${PLAN_ADAPTATION_JSON_SENTINEL}: {"changes":[{"kind":"MOVE","taskRef":"T1","toDate":"YYYY-MM-DD"},{"kind":"ADD","title":"...","subject":null,"taskDate":"YYYY-MM-DD"}]}`,
  ].join("\n");
  const recent = input.recentSummary
    ? `${input.recentSummary.count7d} seans, ${input.recentSummary.focusMinutes7d} dk; konular: ${input.recentSummary.subjects.join(", ") || "yok"}`
    : "yakın dönem çalışma özeti yok";
  const tasks = input.tasks.map((task) => ({
    ref: task.ref,
    date: task.taskDate,
    title: task.title,
    subject: task.subject,
  }));
  const note =
    input.source === "PLAN" && input.note
      ? `\nKullanıcının açık notu: ${input.note}`
      : "";
  return {
    system,
    user: `Sınav: ${input.examType ?? "belirtilmemiş"}\nÇalışma özeti: ${recent}\nSinyal: ${contextSignal}\nBekleyen görevler: ${JSON.stringify(tasks)}${note}`,
  };
}
