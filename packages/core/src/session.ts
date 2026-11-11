import {
  SESSION_FOCUS_MINUTES_MAX,
  SESSION_FOCUS_MINUTES_MIN,
  type SessionPresetDto,
  type SessionPresetId,
} from "@mentor/types";

export const DEFAULT_SESSION_PRESETS: SessionPresetDto[] = [
  { id: "25_5", label: "25 / 5 dk", focusMinutes: 25, breakMinutes: 5 },
  { id: "50_10", label: "50 / 10 dk", focusMinutes: 50, breakMinutes: 10 },
];

function parseCustomMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const num = Number(value);
  if (
    !Number.isInteger(num) ||
    num < SESSION_FOCUS_MINUTES_MIN ||
    num > SESSION_FOCUS_MINUTES_MAX
  ) {
    return null;
  }
  return num;
}

export function parseInitialMinutes(
  presetParam: string | null | undefined,
  minutesParam: string | null | undefined,
): number {
  return (
    parseCustomMinutes(minutesParam) ?? (presetParam === "50_10" ? 50 : 25)
  );
}

export function parseInitialBreakMinutes(
  presetParam: string | null | undefined,
  minutesParam: string | null | undefined,
): number {
  return parseCustomMinutes(minutesParam) != null
    ? 5
    : presetParam === "stopwatch"
      ? 0
      : presetParam === "50_10"
        ? 10
        : 5;
}

export function parseInitialPreset(
  presetParam: string | null | undefined,
  minutesParam: string | null | undefined,
): SessionPresetId {
  return parseCustomMinutes(minutesParam) != null
    ? "custom"
    : presetParam === "stopwatch"
      ? "stopwatch"
      : presetParam === "50_10"
        ? "50_10"
        : "25_5";
}

export function parseInitialSelectedPresetId(
  presetParam: string | null | undefined,
  minutesParam: string | null | undefined,
): string | null {
  return parseCustomMinutes(minutesParam) != null
    ? null
    : presetParam === "stopwatch"
      ? "stopwatch"
      : presetParam === "50_10"
        ? "50_10"
        : "25_5";
}

/** Formats seconds into `MM:SS` tabular display string. */
export function formatTimerDisplay(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
