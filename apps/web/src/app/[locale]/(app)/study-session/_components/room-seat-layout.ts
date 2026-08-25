/**
 * Seat placement around the table — one formula for every capacity, so no room size needs a
 * hand-drawn layout.
 *
 * Seats are spaced by **arc length**, not by angle. Stepping the ellipse parameter uniformly
 * looks right only on a circle: on a tall or wide table it bunches seats at the ends of the
 * short axis and strands them along the long sides. Walking the perimeter at a constant pace
 * costs one cumulative-length table and puts every seat where a person would actually sit.
 */

export interface SeatPosition {
  /** Percentage of the container width — ready for CSS `left`. */
  leftPct: number;
  /** Percentage of the container height — ready for CSS `top`. */
  topPct: number;
}

export interface SeatLayoutOptions {
  /** Ellipse radii as a percentage of the container. Defaults hug a centred table. */
  radiusXPct?: number;
  radiusYPct?: number;
  centerXPct?: number;
  centerYPct?: number;
  /** Where seat 0 sits, in degrees clockwise from the top of the table. */
  startAngleDeg?: number;
}

/** Perimeter samples. 720 keeps the arc-length error far below one pixel at any sane table size. */
const SAMPLES = 720;

const DEFAULTS = {
  radiusXPct: 34,
  radiusYPct: 30,
  centerXPct: 50,
  centerYPct: 50,
  startAngleDeg: 0,
} satisfies Required<SeatLayoutOptions>;

/** Point on the ellipse at parameter `t`; t = 0 is the top, and t grows clockwise on screen. */
function pointAt(
  t: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): SeatPosition {
  const angle = t - Math.PI / 2;
  return {
    leftPct: cx + rx * Math.cos(angle),
    topPct: cy + ry * Math.sin(angle),
  };
}

/**
 * `count` seats evenly spaced around the table.
 *
 * Coordinates are percentages, so the caller positions each seat absolutely and the layout
 * survives any container size. Radii are percentages of *different* axes, which makes the
 * arc length a screen-space approximation — exact on a square container, and visually even
 * on the near-square ones the room view uses.
 */
export function seatPositions(
  count: number,
  options: SeatLayoutOptions = {},
): SeatPosition[] {
  if (!Number.isFinite(count) || count <= 0) return [];

  const { radiusXPct: rx, radiusYPct: ry, centerXPct: cx, centerYPct: cy, startAngleDeg } = {
    ...DEFAULTS,
    ...options,
  };

  // Cumulative perimeter length at each sample, so a target length maps back to a parameter.
  const cumulative: number[] = [0];
  let previous = pointAt(0, cx, cy, rx, ry);
  for (let i = 1; i <= SAMPLES; i++) {
    const current = pointAt((2 * Math.PI * i) / SAMPLES, cx, cy, rx, ry);
    const dx = current.leftPct - previous.leftPct;
    const dy = current.topPct - previous.topPct;
    cumulative.push(cumulative[i - 1]! + Math.hypot(dx, dy));
    previous = current;
  }

  const perimeter = cumulative[SAMPLES]!;
  if (perimeter === 0) {
    // Degenerate table (both radii zero) — every seat collapses onto the centre.
    return Array.from({ length: count }, () => ({ leftPct: cx, topPct: cy }));
  }

  const startLength = lengthAt(cumulative, normalizeTurns(startAngleDeg / 360));
  const step = perimeter / count;

  return Array.from({ length: count }, (_, i) =>
    pointAt(parameterAtLength(cumulative, (startLength + i * step) % perimeter), cx, cy, rx, ry),
  );
}

/** Fractional turns → cumulative length, by interpolating between neighbouring samples. */
function lengthAt(cumulative: number[], turns: number): number {
  const exact = turns * SAMPLES;
  const lower = Math.floor(exact);
  const frac = exact - lower;
  const a = cumulative[lower % SAMPLES]!;
  const b = cumulative[(lower % SAMPLES) + 1]!;
  return a + (b - a) * frac;
}

/** Inverse of the table: cumulative length → ellipse parameter, by binary search. */
function parameterAtLength(cumulative: number[], target: number): number {
  let low = 0;
  let high = SAMPLES;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (cumulative[mid]! < target) low = mid + 1;
    else high = mid;
  }
  const index = Math.max(1, low);
  const before = cumulative[index - 1]!;
  const after = cumulative[index]!;
  const span = after - before;
  const frac = span === 0 ? 0 : (target - before) / span;
  return (2 * Math.PI * (index - 1 + frac)) / SAMPLES;
}

/** Keep a turn count in [0, 1) so a negative or >360° start angle still lands on the table. */
function normalizeTurns(turns: number): number {
  return ((turns % 1) + 1) % 1;
}
