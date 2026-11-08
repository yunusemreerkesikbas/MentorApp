import { expect, it } from "vitest";
import { BASE_MATRIX, screenMatrix } from "../src/phone-matrix";

const nums = (s: string) => s.slice("matrix3d(".length, -1).split(",").map(Number);

it("returns the fitted matrix for the 470 px phone", () => {
  nums(screenMatrix(470)).forEach((v, i) => expect(v).toBeCloseTo(BASE_MATRIX[i], 6));
});

it("scales to the 1000 px phone used in the A story", () => {
  const s1 = [1.97177, -0.282196, 0, -0.000239064, -0.0154825, 2.10933, 0, 2.01634e-5, 0, 0, 1, 0, 66.8149, 138.401, 0, 1];
  nums(screenMatrix(1000)).forEach((v, i) => expect(v).toBeCloseTo(s1[i], 3));
});
