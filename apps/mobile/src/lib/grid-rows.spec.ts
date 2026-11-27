import { test } from "node:test";
import assert from "node:assert/strict";
import { gridRows } from "./grid-rows.ts";

test("gridRows pads the last row so every card keeps one width", () => {
  assert.deepEqual(gridRows([1, 2, 3, 4], 3), [[1, 2, 3], [4, null, null]]);
  assert.deepEqual(gridRows([1, 2], 2), [[1, 2]]);
  assert.deepEqual(gridRows([], 3), []);
});
