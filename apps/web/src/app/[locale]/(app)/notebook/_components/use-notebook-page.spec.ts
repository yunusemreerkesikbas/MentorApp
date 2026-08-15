import { describe, expect, it } from "vitest";
import type { NotebookPageDoc, NotebookPageItem } from "@mentor/types";
import { notebookPageReducer } from "./use-notebook-page";

const sticker: NotebookPageItem = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "sticker",
  asset: "STAR",
  x: 10,
  y: 10,
  width: 80,
  height: 80,
  rotation: 0,
  opacity: 1,
  z: 1,
};

const doc: NotebookPageDoc = { version: 1, paper: "ruled", items: [sticker] };
const base: Parameters<typeof notebookPageReducer>[0] = {
  doc,
  past: [],
  selectedId: null,
  dirty: false,
};

describe("notebookPageReducer", () => {
  it("does not make a page load undoable — opening a page is not an edit", () => {
    const state = notebookPageReducer(
      { ...base, past: [doc], dirty: true },
      { type: "replace", doc },
    );
    expect(state.past).toEqual([]);
    expect(state.dirty).toBe(false);
  });

  it("takes no history snapshot on patch, so a drag cannot flood the undo stack", () => {
    let state = notebookPageReducer(base, { type: "checkpoint" });
    for (let i = 0; i < 50; i += 1) {
      state = notebookPageReducer(state, {
        type: "patch",
        id: sticker.id,
        patch: { x: i },
      });
    }
    expect(state.past).toHaveLength(1);
    expect(state.doc.items[0]!.x).toBe(49);
  });

  it("undo restores the document the checkpoint captured", () => {
    let state = notebookPageReducer(base, { type: "checkpoint" });
    state = notebookPageReducer(state, {
      type: "patch",
      id: sticker.id,
      patch: { x: 999 },
    });
    state = notebookPageReducer(state, { type: "undo" });
    expect(state.doc.items[0]!.x).toBe(10);
  });

  it("drops a selection the undone document never had", () => {
    let state = notebookPageReducer(base, {
      type: "add",
      item: { ...sticker, id: "22222222-2222-4222-8222-222222222222" },
    });
    expect(state.selectedId).toBe("22222222-2222-4222-8222-222222222222");
    state = notebookPageReducer(state, { type: "undo" });
    expect(state.selectedId).toBeNull();
  });

  it("clears the selection when the selected item is removed", () => {
    const state = notebookPageReducer(
      { ...base, selectedId: sticker.id },
      { type: "remove", id: sticker.id },
    );
    expect(state.selectedId).toBeNull();
    expect(state.doc.items).toEqual([]);
  });

  it("bounds the history so a long session cannot grow it without limit", () => {
    let state: Parameters<typeof notebookPageReducer>[0] = base;
    for (let i = 0; i < 60; i += 1) {
      state = notebookPageReducer(state, { type: "checkpoint" });
    }
    expect(state.past.length).toBeLessThanOrEqual(30);
  });
});
