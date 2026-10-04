import type {
  SessionPresetId,
  SessionPresetDto,
  TodayPanelResponse,
} from "@mentor/types";
import { studyDurationMinutesSchema } from "@mentor/validation";
import { readActiveSession, resolveResume } from "@/lib/session-persistence";

export const DEFAULT_PRESETS: SessionPresetDto[] = [
  { id: "25_5", label: "25 / 5 dk", focusMinutes: 25, breakMinutes: 5 },
  { id: "50_10", label: "50 / 10 dk", focusMinutes: 50, breakMinutes: 10 },
];

function customMinutes(value: string | null): number | null {
  if (!value) return null;
  const parsed = studyDurationMinutesSchema.safeParse(Number(value));
  return parsed.success ? parsed.data : null;
}

export function parseInitialMinutes(
  presetParam: string | null,
  minutesParam: string | null,
): number {
  return customMinutes(minutesParam) ?? (presetParam === "50_10" ? 50 : 25);
}

export function parseInitialBreakMinutes(
  presetParam: string | null,
  minutesParam: string | null,
): number {
  return customMinutes(minutesParam) != null
    ? 5
    : presetParam === "stopwatch"
      ? 0
      : presetParam === "50_10"
        ? 10
        : 5;
}

export function parseInitialPreset(
  presetParam: string | null,
  minutesParam: string | null,
): SessionPresetId {
  return customMinutes(minutesParam) != null
    ? "custom"
    : presetParam === "stopwatch"
      ? "stopwatch"
      : presetParam === "50_10"
        ? "50_10"
        : "25_5";
}

export function parseInitialSelectedPresetId(
  presetParam: string | null,
  minutesParam: string | null,
): string | null {
  return customMinutes(minutesParam) != null
    ? null
    : presetParam === "stopwatch"
      ? "stopwatch"
      : presetParam === "50_10"
        ? "50_10"
        : "25_5";
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
