/**
 * Koç yapımı haftalık plan (Faz 2): the LLM returns a JSON draft; this module parses and CLAMPS it
 * to a safe shape. The draft is a preview only — persisting happens through the user-confirmed
 * W2 bulk endpoint, never here (workstreams §2: AI never writes plan tables).
 */

export interface PlanDraftTask {
  title: string;
  subject: string | null;
}

export interface PlanDraftDay {
  date: string;
  tasks: PlanDraftTask[];
}

export const PLAN_DRAFT_DAYS = 7;
export const PLAN_DRAFT_MAX_TASKS_PER_DAY = 3;
export const PLAN_DRAFT_MAX_TASKS_TOTAL = 15;
const TITLE_MAX = 200;
const SUBJECT_MAX = 80;

/** ISO dates [todayIso, todayIso+6] — the only dates a draft may target. */
function allowedDates(todayIso: string): Set<string> {
  const base = new Date(`${todayIso}T00:00:00.000Z`);
  const dates = new Set<string>();
  for (let i = 0; i < PLAN_DRAFT_DAYS; i++) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    dates.add(d.toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Parse the LLM output into a clamped draft. Tolerates code fences / prose around the JSON
 * (first `{` … last `}`). Returns null when nothing parseable/usable remains — the caller
 * turns that into a provider error.
 */
export function parsePlanDraft(text: string, todayIso: string): PlanDraftDay[] | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const rawDays = (parsed as { days?: unknown }).days;
  if (!Array.isArray(rawDays)) return null;

  const allowed = allowedDates(todayIso);
  const byDate = new Map<string, PlanDraftTask[]>();
  let total = 0;

  for (const rawDay of rawDays) {
    const date = (rawDay as { date?: unknown }).date;
    const rawTasks = (rawDay as { tasks?: unknown }).tasks;
    if (typeof date !== "string" || !allowed.has(date) || !Array.isArray(rawTasks)) continue;

    const tasks = byDate.get(date) ?? [];
    for (const rawTask of rawTasks) {
      if (tasks.length >= PLAN_DRAFT_MAX_TASKS_PER_DAY || total >= PLAN_DRAFT_MAX_TASKS_TOTAL) break;
      const title =
        typeof (rawTask as { title?: unknown }).title === "string"
          ? ((rawTask as { title: string }).title.trim().slice(0, TITLE_MAX))
          : "";
      if (!title) continue;
      const rawSubject = (rawTask as { subject?: unknown }).subject;
      const subject =
        typeof rawSubject === "string" && rawSubject.trim()
          ? rawSubject.trim().slice(0, SUBJECT_MAX)
          : null;
      tasks.push({ title, subject });
      total++;
    }
    if (tasks.length > 0) byDate.set(date, tasks);
  }

  if (byDate.size === 0) return null;
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, tasks]) => ({ date, tasks }));
}
