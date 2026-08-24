/** Pure math for circular timer dial — testable without DOM. */

export const DEFAULT_TIMER_MIN = 5;
export const DEFAULT_TIMER_MAX = 120;
export const DEFAULT_TIMER_STEP = 5;

export const TIMER_TICK_COUNT = 60;
export const TIMER_MAJOR_TICK_EVERY = 5;
export const TIMER_TICK_MAJOR_LENGTH = 12;
export const TIMER_TICK_MINOR_LENGTH = 7;
export const TIMER_TICK_OUTER_INSET = 2;

export function timerTickLine(
  index: number,
  cx: number,
  cy: number,
  radius: number,
): { x1: number; y1: number; x2: number; y2: number; major: boolean } {
  const major = index % TIMER_MAJOR_TICK_EVERY === 0;
  const angle = ((index / TIMER_TICK_COUNT) * 360 - 90) * (Math.PI / 180);
  const outer = radius - TIMER_TICK_OUTER_INSET;
  const inner = radius - (major ? TIMER_TICK_MAJOR_LENGTH : TIMER_TICK_MINOR_LENGTH);
  return {
    x1: cx + inner * Math.cos(angle),
    y1: cy + inner * Math.sin(angle),
    x2: cx + outer * Math.cos(angle),
    y2: cy + outer * Math.sin(angle),
    major,
  };
}

/** Angle in degrees from 12 o'clock, clockwise (0–360). */
export function angleFromPointer(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): number {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const x = clientX - cx;
  const y = clientY - cy;
  let angle = Math.atan2(x, -y) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  return angle;
}

export function minutesFromAngle(
  angle: number,
  min = DEFAULT_TIMER_MIN,
  max = DEFAULT_TIMER_MAX,
  step = DEFAULT_TIMER_STEP,
): number {
  const ratio = angle / 360;
  const raw = min + ratio * (max - min);
  const snapped = Math.round(raw / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

export function angleFromMinutes(
  minutes: number,
  min = DEFAULT_TIMER_MIN,
  max = DEFAULT_TIMER_MAX,
): number {
  const ratio = (minutes - min) / (max - min);
  return ratio * 360;
}

export function clampMinutes(
  minutes: number,
  min = DEFAULT_TIMER_MIN,
  max = DEFAULT_TIMER_MAX,
  step = DEFAULT_TIMER_STEP,
): number {
  const snapped = Math.round(minutes / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
