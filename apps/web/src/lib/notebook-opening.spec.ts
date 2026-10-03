import { describe, expect, it } from "vitest";
import { notebookOpening, type NotebookOpeningStart } from "./notebook-opening";

function opening(key: string): NotebookOpeningStart {
  return {
    book: {
      key,
      kind: "CUSTOM",
      title: "Tarih Defterim",
      cover: { color: "forest", material: "kraft" },
      pageCount: 0,
      dueCount: 0,
      subject: null,
      meta: "0 sayfa",
      dueLabel: null,
    },
    from: { x: 0, y: 0, width: 200, height: 283 },
    area: { x: 0, y: 0, width: 1200, height: 800 },
    pose: { rotateX: 34, rotateZ: -2, lifted: false },
    navigate: () => undefined,
  };
}

const landing = { rect: { x: 100, y: 80, width: 900, height: 640 }, single: false };

/*
 * One store for the whole module, as in the app: every test starts by finishing whatever the
 * previous one left in the air.
 */
function fresh(): void {
  notebookOpening.finish(notebookOpening.get().run);
}

describe("notebook opening store", () => {
  it("keeps the desk's book until the flight has drawn its copy", () => {
    fresh();
    const run = notebookOpening.begin(opening("a"));
    expect(notebookOpening.get().underway).toBe(false);
    notebookOpening.underway(run);
    expect(notebookOpening.get().underway).toBe(true);
  });

  it("ignores a flight that is no longer the current one", () => {
    fresh();
    const stale = notebookOpening.begin(opening("a"));
    notebookOpening.finish(stale);
    const run = notebookOpening.begin(opening("b"));
    notebookOpening.underway(stale);
    expect(notebookOpening.get().underway).toBe(false);
    notebookOpening.finish(stale);
    expect(notebookOpening.get().start?.book.key).toBe("b");
    expect(notebookOpening.get().run).toBe(run);
  });

  it("opens the editor on its contents only for the book in the air, until it lands", () => {
    fresh();
    notebookOpening.begin(opening("a"));
    expect(notebookOpening.isOpening("a")).toBe(true);
    expect(notebookOpening.isOpening("b")).toBe(false);
    notebookOpening.land("b", landing);
    expect(notebookOpening.get().landing).toBeNull();
    notebookOpening.land("a", landing);
    expect(notebookOpening.get().landing).toEqual(landing);
    expect(notebookOpening.isOpening("a")).toBe(false);
  });

  it("finishes back to nothing in the air and the next opening is a new run", () => {
    fresh();
    const run = notebookOpening.begin(opening("a"));
    notebookOpening.underway(run);
    notebookOpening.finish(run);
    expect(notebookOpening.get()).toEqual({ run, start: null, underway: false, landing: null });
    expect(notebookOpening.begin(opening("a"))).toBe(run + 1);
  });
});
