/**
 * Seekable motion engine for the "Işık Yandı" prototype.
 *
 * Every value in the scene is a pure function of time, so any frame can be rendered on demand.
 * That is what makes the video capture deterministic (seek → screenshot, 60 times a second) and
 * it keeps the numbers portable: `spring()` solves the same damped-oscillator equation
 * framer-motion uses for `{ type: "spring", stiffness, damping, mass }`, so the React port can
 * reuse the constants as they are.
 */

export const clamp = (value, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, value));
export const lerp = (a, b, t) => a + (b - a) * t;

/** 0 → 1 across `[start, start + duration]`. */
export function progress(t, start, duration) {
  if (duration <= 0) return t >= start ? 1 : 0;
  return clamp((t - start) / duration);
}

/** Smooth 0 → 1 window: rises over `fadeIn`, holds, falls over `fadeOut`. */
export function envelope(t, start, fadeIn, hold, fadeOut) {
  if (t < start) return 0;
  const a = t - start;
  if (a < fadeIn) return ease.outQuad(a / fadeIn);
  if (a < fadeIn + hold) return 1;
  return 1 - ease.inQuad(clamp((a - fadeIn - hold) / fadeOut));
}

/** CSS `cubic-bezier(x1, y1, x2, y2)`. */
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t) => (3 * ax * t + 2 * bx) * t + cx;

  function solveX(x) {
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
  linear: (t) => t,
  inQuad: (t) => t * t,
  inCubic: (t) => t * t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outQuart: cubicBezier(0.25, 1, 0.5, 1),
  outQuint: cubicBezier(0.22, 1, 0.36, 1),
  outExpo: cubicBezier(0.16, 1, 0.3, 1),
  inOutCubic: cubicBezier(0.65, 0, 0.35, 1),
  /** Leaves quickly, arrives softly: flights (spark, badge home). */
  launch: cubicBezier(0.3, 0, 0.2, 1),
  /** Gathers speed into the target: the badge diving into the avatar. */
  dive: cubicBezier(0.55, 0, 0.25, 1),
};

/**
 * Damped spring from 0 → 1. `x(t)` is the remaining displacement (1 → 0, oscillating),
 * `value(t)` the position. Stiffness / damping / mass match framer-motion's spring options.
 */
export function spring({ stiffness = 100, damping = 10, mass = 1, velocity = 0 } = {}) {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const x = (t) => {
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
  return { x, value: (t) => 1 - x(t), zeta, w0 };
}

/**
 * Velocity kick: 0 → peak 1 → small opposite swing → 0. Squash rebounds, punches and pulses use
 * it, because they start from rest instead of jumping to a displaced value.
 */
export function kick({ stiffness = 300, damping = 12, mass = 1 } = {}) {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const a = zeta * w0;
  const wd = w0 * Math.sqrt(Math.max(1e-6, 1 - zeta * zeta));
  const tPeak = Math.atan2(wd, a) / wd;
  const peak = Math.exp(-a * tPeak) * Math.sin(wd * tPeak);
  return (t) => (t <= 0 ? 0 : (Math.exp(-a * t) * Math.sin(wd * t)) / peak);
}

/** Spring from `from` to `to`, released at `start`. Holds `from` before that. */
export function springTo(t, start, from, to, config) {
  return lerp(from, to, config.value(t - start));
}

/**
 * Piecewise keyframes: `[[time, value], [time, value, easing], …]`. The easing on a frame shapes
 * the segment that arrives at it.
 */
export function keys(t, frames) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i += 1) {
    const [t1, v1, easing = ease.linear] = frames[i];
    const [t0, v0] = frames[i - 1];
    if (t <= t1) return lerp(v0, v1, easing(progress(t, t0, t1 - t0)));
  }
  return frames[frames.length - 1][1];
}

/** Deterministic PRNG (mulberry32). The same seed draws the same particles on every frame. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function quadPoint(p0, p1, p2, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

export function quadTangent(p0, p1, p2, t) {
  return {
    x: 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
  };
}

export function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

export function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha)})`;
}

export function mixHex(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const channel = (x, y) => Math.round(lerp(x, y, t)).toString(16).padStart(2, "0");
  return `#${channel(ca.r, cb.r)}${channel(ca.g, cb.g)}${channel(ca.b, cb.b)}`;
}
