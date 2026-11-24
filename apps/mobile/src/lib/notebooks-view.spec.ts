import assert from "node:assert/strict";
import { test } from "node:test";
import type { NotebookPageDoc } from "@mentor/types";
import { NOTEBOOK_MAX_PAGES } from "@mentor/validation";
import { appendStroke, nextPageIndex, readPageParam, newWriting, replacePageItem, strokeCoordinates } from "./notebooks-view.ts";

const blank: NotebookPageDoc = { version: 1, paper: "plain", items: [], ink: [] };

test("contents append after the highest written page including sparse notebooks", () => {
  assert.equal(nextPageIndex([]), 0);
  assert.equal(nextPageIndex([{ pageIndex: 8 }, { pageIndex: 1 }]), 9);
});
test("page links accept zero-based indices and reject malformed or out-of-range values", () => {
  assert.equal(readPageParam("0"), 0);
  assert.equal(readPageParam("14"), 14);
  assert.equal(readPageParam(String(NOTEBOOK_MAX_PAGES - 1)), NOTEBOOK_MAX_PAGES - 1);
  assert.equal(readPageParam(String(NOTEBOOK_MAX_PAGES)), null);
  for (const value of [undefined, "", "-1", "1.5", "1abc", "9007199254740993"]) assert.equal(readPageParam(value), null);
});
test("editing a block retains other layers, paper geometry and web ink", () => {
  const first = newWriting(blank, "first", "#111111");
  const ink = [{ id: "ink", tool: "pen" as const, color: "#111111", opacity: 1, size: 6, points: [1,2,0.5,3,4,0.5] }];
  const image = { ...first, id: "photo", kind: "image" as const, frame: "none" as const, storageKey: "private-photo", z: 9 };
  const doc: NotebookPageDoc = { ...blank, ink, items: [image, first] };
  const edit = replacePageItem(doc, { ...first, text: "My note" });
  assert.equal(edit.items[0], image);
  assert.equal(edit.ink, ink);
  assert.equal(first.text, "");
  assert.equal(newWriting(edit, "next", "#111111").z, 10);
});
test("ink uses design-space coordinates and skips pressure channels", () => {
  assert.equal(strokeCoordinates([0, 3, 0.4, 7, 10, 0.7]), "0,3 7,10");
});

test("ink stops at the shared page budget even while the pen stays active", () => {
  const stroke = { id: "ink", tool: "pen" as const, color: "#111111", opacity: 1, size: 6, points: [1,2,0.5,3,4,0.5,5,6,0.5] };
  const first = appendStroke(blank, stroke, 2, 5);
  const second = appendStroke(first, stroke, 2, 5);
  assert.equal(second.ink[1]?.points.length, 6);
  assert.equal(appendStroke(second, stroke, 2, 100), second);
  assert.equal(appendStroke(second, stroke, 4, 5), second);
});
