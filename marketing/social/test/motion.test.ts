import { expect, it } from "vitest";
import { countAt, pop, shake, slam, slideUp } from "../src/motion";

const fps = 30;
const at = 30;
const f = (fn: (x: number) => number, from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => fn(from + i));

it("pop is hidden before its frame, overshoots, then settles fast", () => {
  expect(pop(at - 1, fps, at)).toBe(0);
  expect(Math.max(...f((x) => pop(x, fps, at), at, at + 20))).toBeGreaterThanOrEqual(1.05);
  expect(Math.abs(pop(at + 14, fps, at) - 1)).toBeLessThanOrEqual(0.03);
});

it("slam starts big and lands at 1 within 12 frames", () => {
  expect(slam(at, fps, at)).toBeGreaterThanOrEqual(1.6);
  expect(Math.abs(slam(at + 12, fps, at) - 1)).toBeLessThanOrEqual(0.03);
});

it("slideUp waits below, overshoots past 0, then settles", () => {
  expect(slideUp(at - 1, fps, at, 400)).toBe(400);
  expect(Math.min(...f((x) => slideUp(x, fps, at, 400), at, at + 20))).toBeLessThan(0);
  expect(Math.abs(slideUp(at + 14, fps, at, 400))).toBeLessThanOrEqual(12);
});

it("shake dies out within 12 frames", () => {
  expect(shake(at + 12, at)).toBeCloseTo(0, 1);
  expect(shake(at - 1, at)).toBe(0);
});

it("counts the beats that have landed", () => {
  const beats = [30, 60, 90, 120];
  expect(countAt(29, beats)).toBe(0);
  expect(countAt(30, beats)).toBe(1);
  expect(countAt(95, beats)).toBe(3);
  expect(countAt(300, beats)).toBe(4);
});
