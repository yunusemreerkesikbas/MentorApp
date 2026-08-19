import { describe, expect, it } from "vitest";
import type {
  NotebookInkStroke,
  NotebookPageDoc,
  NotebookPageItem,
} from "@mentor/types";
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

function makeStroke(id: string): NotebookInkStroke {
  return {
    id,
    tool: "pen",
    color: "#111111",
    size: 8,
    opacity: 1,
    points: [0, 0, 0.5, 10, 10, 0.5],
  };
}

const doc: NotebookPageDoc = {
  version: 1,
  paper: "ruled",
  items: [sticker],
  ink: [],
};
const base: Parameters<typeof notebookPageReducer>[0] = {
  doc,
  past: [],
  future: [],
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

  describe("ink", () => {
    it("makes each stroke its own undo step", () => {
      let state = notebookPageReducer(base, {
        type: "addStroke",
        stroke: makeStroke("a1111111-1111-4111-8111-111111111111"),
      });
      state = notebookPageReducer(state, {
        type: "addStroke",
        stroke: makeStroke("a2222222-2222-4222-8222-222222222222"),
      });
      expect(state.doc.ink).toHaveLength(2);

      state = notebookPageReducer(state, { type: "undo" });
      expect(state.doc.ink).toHaveLength(1);
      expect(state.dirty).toBe(true);
    });

    it("erases a whole swipe in one step, however many strokes it caught", () => {
      let state: Parameters<typeof notebookPageReducer>[0] = base;
      for (const id of ["a1", "a2", "a3"]) {
        state = notebookPageReducer(state, {
          type: "addStroke",
          stroke: makeStroke(id),
        });
      }
      const before = state.past.length;

      state = notebookPageReducer(state, {
        type: "eraseStrokes",
        ids: ["a1", "a3"],
      });
      expect(state.doc.ink.map((s) => s.id)).toEqual(["a2"]);
      expect(state.past.length).toBe(before + 1);

      state = notebookPageReducer(state, { type: "undo" });
      expect(state.doc.ink).toHaveLength(3);
    });

    it("does not record an undo step for an erase that hit nothing", () => {
      const state = notebookPageReducer(base, {
        type: "eraseStrokes",
        ids: ["nothing-here"],
      });
      // Swiping the eraser over blank paper should not leave a step that appears to do nothing.
      expect(state).toBe(base);
    });

    it("leaves items alone when clearing ink", () => {
      let state = notebookPageReducer(base, {
        type: "addStroke",
        stroke: makeStroke("a1"),
      });
      state = notebookPageReducer(state, { type: "clearInk" });
      expect(state.doc.ink).toEqual([]);
      expect(state.doc.items).toEqual([sticker]);
    });

    it("treats clearing an already-blank page as a no-op", () => {
      expect(notebookPageReducer(base, { type: "clearInk" })).toBe(base);
    });
  });

  describe("redo", () => {
    it("puts back what undo took", () => {
      let state = notebookPageReducer(base, {
        type: "addStroke",
        stroke: makeStroke("a1"),
      });
      state = notebookPageReducer(state, { type: "undo" });
      expect(state.doc.ink).toHaveLength(0);

      state = notebookPageReducer(state, { type: "redo" });
      expect(state.doc.ink).toHaveLength(1);
    });

    it("does nothing when there is nothing ahead", () => {
      expect(notebookPageReducer(base, { type: "redo" })).toBe(base);
    });

    /*
     * The branch that actually bites: undo, then draw something new. The undone stroke is now
     * unreachable, and redoing it would drop it into a page that has moved on.
     */
    it("discards the redo stack once a new edit lands", () => {
      let state = notebookPageReducer(base, {
        type: "addStroke",
        stroke: makeStroke("a1"),
      });
      state = notebookPageReducer(state, { type: "undo" });
      expect(state.future).toHaveLength(1);

      state = notebookPageReducer(state, {
        type: "addStroke",
        stroke: makeStroke("a2"),
      });
      expect(state.future).toEqual([]);

      state = notebookPageReducer(state, { type: "redo" });
      expect(state.doc.ink.map((s) => s.id)).toEqual(["a2"]);
    });

    it("is cleared by loading a page, not carried across", () => {
      let state = notebookPageReducer(base, { type: "checkpoint" });
      state = notebookPageReducer(state, { type: "undo" });
      state = notebookPageReducer(state, { type: "replace", doc });
      expect(state.future).toEqual([]);
      expect(state.past).toEqual([]);
    });

    it("survives a drag, which patches without checkpointing", () => {
      let state = notebookPageReducer(base, { type: "checkpoint" });
      state = notebookPageReducer(state, {
        type: "patch",
        id: sticker.id,
        patch: { x: 500 },
      });
      state = notebookPageReducer(state, { type: "undo" });
      state = notebookPageReducer(state, { type: "redo" });
      expect(state.doc.items[0]!.x).toBe(500);
    });
  });
});
