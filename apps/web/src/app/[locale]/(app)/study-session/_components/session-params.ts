import type { SessionPresetDto, TodayPanelResponse } from "@mentor/types";
import { readActiveSession, resolveResume } from "@/lib/session-persistence";

export const DEFAULT_PRESETS: SessionPresetDto[] = [
  { id: "25_5", label: "25 / 5 dk", focusMinutes: 25, breakMinutes: 5 },
  { id: "50_10", label: "50 / 10 dk", focusMinutes: 50, breakMinutes: 10 },
];

export function parseInitialMinutes(
  presetParam: string | null,
  minutesParam: string | null,
): number {
  if (minutesParam) {
    const n = Number.parseInt(minutesParam, 10);
    if (!Number.isNaN(n) && n >= 5 && n <= 120 && n % 5 === 0) return n;
  }
  if (presetParam === "50_10") return 50;
  return 25;
}

export function parseInitialBreakMinutes(
  presetParam: string | null,
  minutesParam: string | null,
): number {
  if (minutesParam) {
    const n = Number.parseInt(minutesParam, 10);
    if (!Number.isNaN(n) && n >= 5 && n <= 120 && n % 5 === 0) return 5;
  }
  if (presetParam === "50_10") return 10;
  return 5;
}

export function parseInitialPreset(
  presetParam: string | null,
  minutesParam: string | null,
): "25_5" | "50_10" | "custom" {
  if (minutesParam) {
    const n = Number.parseInt(minutesParam, 10);
    if (!Number.isNaN(n) && n >= 5 && n <= 120 && n % 5 === 0) return "custom";
  }
  if (presetParam === "50_10") return "50_10";
  return "25_5";
}

export function parseInitialSelectedPresetId(
  presetParam: string | null,
  minutesParam: string | null,
): string | null {
  if (minutesParam) {
    const n = Number.parseInt(minutesParam, 10);
    if (!Number.isNaN(n) && n >= 5 && n <= 120 && n % 5 === 0) return null;
  }
  if (presetParam === "50_10") return "50_10";
  return "25_5";
}

/** Persisted session the timer hook will actually resume (not stale/finished). */
export function readRestorableRecord() {
  const record = readActiveSession();
  if (!record) return null;
  const kind = resolveResume(record, Date.now()).kind;
  return kind === "discard" || kind === "done" ? null : record;
}

export function unwrapTodayResponse(response: unknown): TodayPanelResponse {
  return ((response as { data?: TodayPanelResponse }).data ??
    response) as TodayPanelResponse;
}
