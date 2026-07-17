/**
 * Map history date-preset chips → inclusive UTC yyyy-mm-dd bounds for GET /study-sessions.
 * `all` → no filter params.
 */

export type HistoryDatePreset = "all" | "today" | "7d" | "30d";

export function historyDateRange(
  preset: HistoryDatePreset,
  now: Date = new Date(),
): { from?: string; to?: string } {
  if (preset === "all") return {};

  const to = now.toISOString().slice(0, 10);
  if (preset === "today") return { from: to, to };

  const daysBack = preset === "7d" ? 6 : 29; // inclusive window: today + (n-1) prior days
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - daysBack);
  return { from: fromDate.toISOString().slice(0, 10), to };
}
