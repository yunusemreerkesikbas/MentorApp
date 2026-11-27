import type { StudyRoomTheme } from "@mentor/types";

/** The web's room limits (`apps/web/src/lib/study-room-theme.ts`). */
export const ROOM_THEMES: readonly StudyRoomTheme[] = ["LIBRARY", "CAFE", "HOME"];
export const ROOM_CAPACITY = { min: 2, max: 10, initial: 4 } as const;
export const ROOM_NAME_MAX = 40;

export function stepRoomTheme(theme: StudyRoomTheme, delta: 1 | -1): StudyRoomTheme {
  const i = ROOM_THEMES.indexOf(theme);
  return ROOM_THEMES[(i + delta + ROOM_THEMES.length) % ROOM_THEMES.length]!;
}

/** "Ayşe Nur Kaya" → "Ayşe K." — the web seat label. */
export function seatLabel(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? displayName;
  return `${parts[0]} ${parts[parts.length - 1]!.charAt(0)}.`;
}

/** The web invite link (mobile shares it; the in-app route waits for the store build). */
export function roomInviteLink(code: string, locale: string): string {
  const q = `?kod=${encodeURIComponent(code)}`;
  return locale === "en" ? `https://puhukoc.com/en/join-room${q}` : `https://puhukoc.com/masaya-katil${q}`;
}

export interface SeatPosition { leftPct: number; topPct: number }

const SAMPLES = 720;

/**
 * Port of the web `room-seat-layout.ts`: `count` seats on an ellipse at equal arc length
 * (equal angles bunch seats at the long sides), first seat at 12 o'clock. `yScale` measures
 * vertical distance in a non-square box. ponytail: no start-angle option, the web never sets it.
 */
export function seatPositions(
  count: number,
  { rx = 34, ry = 30, yScale = 1 }: { rx?: number; ry?: number; yScale?: number } = {},
): SeatPosition[] {
  if (!Number.isFinite(count) || count <= 0) return [];
  const at = (t: number): SeatPosition => ({
    leftPct: 50 + rx * Math.cos(t - Math.PI / 2),
    topPct: 50 + ry * Math.sin(t - Math.PI / 2),
  });
  const cumulative = [0];
  let prev = at(0);
  for (let i = 1; i <= SAMPLES; i++) {
    const cur = at((2 * Math.PI * i) / SAMPLES);
    cumulative.push(cumulative[i - 1]! + Math.hypot(cur.leftPct - prev.leftPct, (cur.topPct - prev.topPct) * yScale));
    prev = cur;
  }
  const perimeter = cumulative[SAMPLES]!;
  return Array.from({ length: count }, (_, k) => {
    const target = (perimeter * k) / count;
    let low = 0;
    let high = SAMPLES;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (cumulative[mid]! < target) low = mid + 1;
      else high = mid;
    }
    const i = Math.max(1, low);
    const span = cumulative[i]! - cumulative[i - 1]!;
    const frac = span === 0 ? 0 : (target - cumulative[i - 1]!) / span;
    return at((2 * Math.PI * (i - 1 + frac)) / SAMPLES);
  });
}
