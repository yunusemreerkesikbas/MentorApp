import { describe, expect, it } from "vitest";
import type { VisionBoardDoc, VisionBoardTextItem } from "@mentor/types";
import { EMPTY_BOARD, createTextItem } from "@/components/vision-board/board-document";
import { boardReducer, initialBoardState, type BoardState } from "./use-board-reducer";

const uid = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

function stateWith(items: VisionBoardDoc["items"]): BoardState {
  return initialBoardState({ ...EMPTY_BOARD, items });
}

function text(n: number, label = `metin ${n}`): VisionBoardTextItem {
  return createTextItem(uid(n), label, []);
}

describe("boardReducer", () => {
  it("adds an item, selects it, and marks the board dirty", () => {
    const next = boardReducer(stateWith([]), { type: "add", item: text(1) });
    expect(next.doc.items).toHaveLength(1);
    expect(next.selectedId).toBe(uid(1));
    expect(next.dirty).toBe(true);
  });

  it("undoes an add", () => {
    const added = boardReducer(stateWith([]), { type: "add", item: text(1) });
    const undone = boardReducer(added, { type: "undo" });
    expect(undone.doc.items).toHaveLength(0);
    expect(undone.future).toHaveLength(1);
  });

  it("redoes what it undid", () => {
    const added = boardReducer(stateWith([]), { type: "add", item: text(1) });
    const redone = boardReducer(boardReducer(added, { type: "undo" }), { type: "redo" });
    expect(redone.doc.items).toHaveLength(1);
  });

  it("undo is a no-op with nothing in history", () => {
    const start = stateWith([text(1)]);
    expect(boardReducer(start, { type: "undo" })).toBe(start);
  });

  /**
   * The reason `transient` exists: a drag emits a patch per pointer move, and recording each one
   * would spend the whole 30-step history on one gesture.
   */
  it("keeps transient patches out of the undo history", () => {
    let state = stateWith([text(1)]);
    for (let x = 0; x < 20; x += 1) {
      state = boardReducer(state, {
        type: "patch",
        id: uid(1),
        patch: { x },
        transient: true,
      });
    }
    expect(state.past).toHaveLength(0);
    expect(state.doc.items[0]?.x).toBe(19);

    // Pointer-up commits once, so undo returns to where the gesture started.
    state = boardReducer(state, { type: "patch", id: uid(1), patch: { x: 19 } });
    expect(state.past).toHaveLength(1);
  });

  /**
   * The whole point of `checkpoint`. An earlier version committed on pointer-UP, but by then the
   * transient patches had already advanced `doc` — so the undo stack recorded where the drag
   * ENDED and undo did nothing. The snapshot has to be taken before the first move.
   */
  it("undo returns to where a drag started, not where it ended", () => {
    let state: BoardState = { ...stateWith([{ ...text(1), x: 100 }]), selectedId: uid(1) };

    state = boardReducer(state, { type: "checkpoint" });
    for (const x of [120, 180, 260, 300]) {
      state = boardReducer(state, {
        type: "patch",
        id: uid(1),
        patch: { x },
        transient: true,
      });
    }
    expect(state.doc.items[0]?.x).toBe(300);

    const undone = boardReducer(state, { type: "undo" });
    expect(undone.doc.items[0]?.x).toBe(100);
  });

  it("a click that never moves leaves the history untouched", () => {
    const state = stateWith([text(1)]);
    const clicked = boardReducer(state, { type: "select", id: uid(1) });
    expect(clicked.past).toHaveLength(0);
    expect(clicked.dirty).toBe(false);
  });

  it("caps the history at 30 steps", () => {
    let state = stateWith([text(1)]);
    for (let i = 0; i < 40; i += 1) {
      state = boardReducer(state, { type: "patch", id: uid(1), patch: { x: i } });
    }
    expect(state.past).toHaveLength(30);
  });

  it("drops the redo branch once a new edit lands", () => {
    const added = boardReducer(stateWith([]), { type: "add", item: text(1) });
    const undone = boardReducer(added, { type: "undo" });
    const diverged = boardReducer(undone, { type: "add", item: text(2) });
    expect(diverged.future).toHaveLength(0);
  });

  it("clears the selection when the selected item is removed", () => {
    const start = { ...stateWith([text(1), text(2)]), selectedId: uid(1) };
    const next = boardReducer(start, { type: "remove", id: uid(1) });
    expect(next.selectedId).toBeNull();
    expect(next.doc.items).toHaveLength(1);
  });

  it("keeps the selection when a different item is removed", () => {
    const start = { ...stateWith([text(1), text(2)]), selectedId: uid(1) };
    const next = boardReducer(start, { type: "remove", id: uid(2) });
    expect(next.selectedId).toBe(uid(1));
  });

  it("bringToFront puts the item above every other z", () => {
    const start = stateWith([
      { ...text(1), z: 5 },
      { ...text(2), z: 9 },
    ]);
    const next = boardReducer(start, { type: "bringToFront", id: uid(1) });
    expect(next.doc.items.find((i) => i.id === uid(1))?.z).toBe(10);
  });

  /** `z` is a non-negative int in the schema, so the bottom item cannot simply go to -1. */
  it("sendToBack lifts everyone else when the floor is already 0", () => {
    const start = stateWith([
      { ...text(1), z: 0 },
      { ...text(2), z: 1 },
    ]);
    const next = boardReducer(start, { type: "sendToBack", id: uid(2) });
    expect(next.doc.items.find((i) => i.id === uid(2))?.z).toBe(0);
    expect(next.doc.items.find((i) => i.id === uid(1))?.z).toBe(1);
  });

  it("sendToBack drops below the floor when there is room", () => {
    const start = stateWith([
      { ...text(1), z: 3 },
      { ...text(2), z: 7 },
    ]);
    const next = boardReducer(start, { type: "sendToBack", id: uid(2) });
    expect(next.doc.items.find((i) => i.id === uid(2))?.z).toBe(2);
  });

  it("saved clears dirty without touching the document", () => {
    const added = boardReducer(stateWith([]), { type: "add", item: text(1) });
    const saved = boardReducer(added, { type: "saved" });
    expect(saved.dirty).toBe(false);
    expect(saved.doc).toBe(added.doc);
  });
});
