import { describe, expect, it } from "vitest";

import { SPRINGS } from "./scene-choreography";
import { cubicBezier, ease, keys, kick, rgba, rng, spring } from "./scene-engine";

function peakOf(fn: (t: number) => number, until = 3): number {
  let peak = Number.NEGATIVE_INFINITY;
  for (let t = 0; t <= until; t += 0.001) peak = Math.max(peak, fn(t));
  return peak;
}

describe("cubicBezier", () => {
  it("pins the endpoints and stays monotonic for an ease-out curve", () => {
    const curve = cubicBezier(0.22, 1, 0.36, 1);
    expect(curve(0)).toBe(0);
    expect(curve(1)).toBe(1);
    let previous = 0;
    for (let x = 0.05; x <= 1; x += 0.05) {
      const y = curve(x);
      expect(y).toBeGreaterThanOrEqual(previous);
      previous = y;
    }
    expect(curve(0.5)).toBeGreaterThan(0.85);
  });
});

describe("spring", () => {
  it("settles on the target", () => {
    expect(spring(SPRINGS.badge).value(3)).toBeCloseTo(1, 4);
    expect(spring(SPRINGS.flip).value(3)).toBeCloseTo(1, 4);
  });

  it("overshoots by the amounts the choreography promises", () => {
    // badge ≈18 %, title ≈12 %, ledge ≈15 %, flip lands near 192° on a 194° swing.
    expect(peakOf(spring(SPRINGS.badge).value) - 1).toBeCloseTo(0.18, 1);
    expect(peakOf(spring(SPRINGS.title).value) - 1).toBeCloseTo(0.12, 1);
    expect(peakOf(spring(SPRINGS.ledge).value) - 1).toBeCloseTo(0.15, 1);
    const flipPeak = -14 + 194 * peakOf(spring(SPRINGS.flip).value);
    expect(flipPeak).toBeGreaterThan(186);
    expect(flipPeak).toBeLessThan(198);
  });

  it("holds still before it is released", () => {
    expect(spring(SPRINGS.badge).value(-0.2)).toBe(0);
  });
});

describe("kick", () => {
  it("starts at rest, peaks at exactly 1 and dies out", () => {
    const pulse = kick(SPRINGS.pulse);
    expect(pulse(0)).toBe(0);
    expect(peakOf(pulse)).toBeCloseTo(1, 2);
    expect(Math.abs(pulse(2))).toBeLessThan(0.01);
  });
});

describe("keys", () => {
  it("interpolates with the arriving frame's easing", () => {
    const frames = [
      [0, 0],
      [1, 10, ease.inQuad],
    ] as const;
    expect(keys(-1, frames)).toBe(0);
    expect(keys(0.5, frames)).toBeCloseTo(2.5);
    expect(keys(2, frames)).toBe(10);
  });
});

describe("rng", () => {
  it("is deterministic per seed", () => {
    const a = rng(7);
    const b = rng(7);
    const c = rng(8);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect(c()).not.toBe(first[0]);
    expect(first.every((n) => n >= 0 && n < 1)).toBe(true);
  });
});

describe("rgba", () => {
  it("expands a hex colour and clamps alpha", () => {
    expect(rgba("#FFC46B", 0.5)).toBe("rgba(255, 196, 107, 0.5)");
    expect(rgba("#000000", 2)).toBe("rgba(0, 0, 0, 1)");
  });
});
