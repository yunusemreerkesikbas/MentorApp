/**
 * Seekable motion maths for the achievement scene ("Işık Yandı").
 *
 * Ported from the approved prototype (`design/achievement-scene/engine.mjs`). Everything the scene
 * paints is a pure function of time, so any frame can be computed on demand: a throttled tab
 * catches up on its next frame, a skip jumps straight to the settled frame, and the maths runs
 * under Vitest in Node. `spring()` solves the same damped oscillator framer-motion uses for
 * `{ type: "spring", stiffness, damping, mass }`, so the constants mean the same thing in both.
 */

export type Easing = (t: number) => number;

export interface Point {
  x: number;
  y: number;
}

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass?: number;
  /** Initial velocity in progress units per second. */
  velocity?: number;
}

export interface Spring {
  /** Remaining displacement: 1 at release, oscillating towards 0. */
  x(t: number): number;
  /** Position: 0 at release, settling at 1. */
  value(t: number): number;
  /** Damping ratio; below 1 the spring overshoots. */
  zeta: number;
}

export const clamp = (value: number, lo = 0, hi = 1): number =>
  Math.min(hi, Math.max(lo, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** 0 → 1 across `[start, start + duration]`. */
export function progress(t: number, start: number, duration: number): number {
  if (duration <= 0) return t >= start ? 1 : 0;
  return clamp((t - start) / duration);
}

/** CSS `cubic-bezier(x1, y1, x2, y2)`. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  function solveX(x: number): number {
    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < 1e-6) return t;
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    while (hi - lo > 1e-6) {
      if (sampleX(t) < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  }

  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solveX(x)));
}

export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  inCubic: (t: number) => t * t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outQuart: cubicBezier(0.25, 1, 0.5, 1),
  outQuint: cubicBezier(0.22, 1, 0.36, 1),
  outExpo: cubicBezier(0.16, 1, 0.3, 1),
  inOutCubic: cubicBezier(0.65, 0, 0.35, 1),
  /** Leaves quickly, arrives softly: the spark's flight. */
  launch: cubicBezier(0.3, 0, 0.2, 1),
  /** Gathers speed into the target: the badge diving into the avatar. */
  dive: cubicBezier(0.55, 0, 0.25, 1),
} satisfies Record<string, Easing>;

export function spring({ stiffness, damping, mass = 1, velocity = 0 }: SpringConfig): Spring {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const x = (t: number): number => {
    if (t <= 0) return 1;
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      return (
        Math.exp(-zeta * w0 * t) *
        (Math.cos(wd * t) + ((zeta * w0 - velocity) / wd) * Math.sin(wd * t))
      );
    }
    if (zeta === 1) return Math.exp(-w0 * t) * (1 + (w0 - velocity) * t);
    const wd = w0 * Math.sqrt(zeta * zeta - 1);
    return (
      Math.exp(-zeta * w0 * t) *
      (Math.cosh(wd * t) + ((zeta * w0 - velocity) / wd) * Math.sinh(wd * t))
    );
  };
  return { x, value: (t) => 1 - x(t), zeta };
}

/**
 * Velocity kick: 0 → 1 at its peak → a smaller swing the other way → 0. Squash rebounds, the
 * burst's camera punch and the avatar's pulse start from rest instead of jumping to a displaced
 * value, which is what a spring released from 1 would do.
 */
export function kick({ stiffness, damping, mass = 1 }: SpringConfig): (t: number) => number {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const decay = zeta * w0;
  const wd = w0 * Math.sqrt(Math.max(1e-6, 1 - zeta * zeta));
  const tPeak = Math.atan2(wd, decay) / wd;
  const peak = Math.exp(-decay * tPeak) * Math.sin(wd * tPeak);
  return (t) => (t <= 0 ? 0 : (Math.exp(-decay * t) * Math.sin(wd * t)) / peak);
}

export type Keyframe = readonly [time: number, value: number, easing?: Easing];

/** Piecewise keyframes; a frame's easing shapes the segment that arrives at it. */
export function keys(t: number, frames: ReadonlyArray<Keyframe>): number {
  const first = frames[0];
  if (!first) return 0;
  if (t <= first[0]) return first[1];
  for (let i = 1; i < frames.length; i += 1) {
    const [t1, v1, easing = ease.linear] = frames[i]!;
    const [t0, v0] = frames[i - 1]!;
    if (t <= t1) return lerp(v0, v1, easing(progress(t, t0, t1 - t0)));
  }
  return frames[frames.length - 1]![1];
}

/** Deterministic PRNG (mulberry32): the same seed scatters the same particles on every frame. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function quadPoint(p0: Point, p1: Point, p2: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

export function quadTangent(p0: Point, p1: Point, p2: Point, t: number): Point {
  return {
    x: 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
  };
}

/** `#RRGGBB` + alpha → `rgba()`. */
export function rgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha)})`;
}
