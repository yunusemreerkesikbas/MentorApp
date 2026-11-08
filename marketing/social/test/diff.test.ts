import { expect, it } from "vitest";
import { diffRatio } from "../src/diff";

const a = new Uint8Array(16).fill(100); // 4 RGBA pixels

it("is 0 for identical images", () => {
  expect(diffRatio(a, a.slice(), 48)).toBe(0);
});

it("counts pixels whose largest channel moves past delta", () => {
  const b = a.slice();
  b[0] = 200;
  expect(diffRatio(a, b, 48)).toBe(0.25);
});

it("ignores small differences", () => {
  const c = a.slice();
  c[0] = 110;
  expect(diffRatio(a, c, 48)).toBe(0);
});

it("refuses images of different sizes", () => {
  expect(() => diffRatio(a, new Uint8Array(12), 48)).toThrow();
});
