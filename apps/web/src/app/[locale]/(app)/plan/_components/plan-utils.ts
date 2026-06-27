export type PlanViewMode = "list" | "timeline" | "week";

const VIEW_STORAGE_KEY = "mentor.plan.viewMode";

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** True when `iso` is strictly before the user's local calendar today. */
export function isPastDate(iso: string): boolean {
  return iso < todayIso();
}

export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday-start week containing `iso`. */
export function weekStart(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function weekDates(fromMonday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftDate(fromMonday, i));
}

/** Inclusive ISO bounds for a calendar month (monthIndex 0–11). */
export function monthIsoBounds(
  year: number,
  monthIndex: number,
): { from: string; to: string } {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const month = String(monthIndex + 1).padStart(2, "0");
  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function formatDateLabel(
  iso: string,
  locale: string,
  todayLabel: string,
  options?: { compact?: boolean; alwaysFull?: boolean },
): string {
  const today = todayIso();
  if (!options?.alwaysFull && iso === today) return todayLabel;
  const d = new Date(`${iso}T12:00:00`);
  if (options?.compact) {
    return d.toLocaleDateString(locale === "en" ? "en-GB" : "tr-TR", {
      day: "numeric",
      month: "short",
    });
  }
  return d.toLocaleDateString(locale === "en" ? "en-GB" : "tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatWeekdayShort(iso: string, locale: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(
    locale === "en" ? "en-GB" : "tr-TR",
    { weekday: "short" },
  );
}

export function formatDayNumber(iso: string): string {
  return String(new Date(`${iso}T12:00:00`).getDate());
}

export function formatMonthDayShort(iso: string, locale: string): {
  day: string;
  month: string;
} {
  const d = new Date(`${iso}T12:00:00`);
  const parts = d.toLocaleDateString(locale === "en" ? "en-GB" : "tr-TR", {
    day: "numeric",
    month: "short",
  });
  const [day, month] = parts.split(" ");
  return { day: day ?? "", month: (month ?? "").replace(".", "").toUpperCase() };
}

export function formatWeekRangeLabel(
  from: string,
  to: string,
  locale: string,
): string {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  const fmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "tr-TR", {
    day: "numeric",
    month: "long",
    year: start.getFullYear() !== end.getFullYear() ? "numeric" : undefined,
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

export function readStoredViewMode(): PlanViewMode {
  if (typeof window === "undefined") return "list";
  const raw = window.localStorage.getItem(VIEW_STORAGE_KEY);
  if (raw === "list" || raw === "timeline" || raw === "week") return raw;
  return "list";
}

export function persistViewMode(mode: PlanViewMode): void {
  window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
}

export function taskStats(tasks: { status: string }[]): {
  done: number;
  total: number;
  percent: number;
} {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "DONE").length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, percent };
}
