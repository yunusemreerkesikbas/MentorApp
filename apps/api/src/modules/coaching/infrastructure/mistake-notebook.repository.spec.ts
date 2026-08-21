import { describe, expect, it } from "vitest";
import { notebookEntryImageKeys } from "./mistake-notebook.repository";

/**
 * The orphan sweep deletes every object under `notebook/` that `listAllReferencedImageKeys` does
 * not name. That makes this collector the whitelist: a photo column missing from it is a photo
 * that disappears once the grace period passes, silently and for every user at once.
 *
 * The repository's own SELECT cannot be covered here — there is no database in this suite — so
 * this pins the half that can be: given a row, every key on it comes back.
 */
describe("notebookEntryImageKeys", () => {
  it("returns the question photo and the solution photo together", () => {
    expect(
      notebookEntryImageKeys({
        storageKey: "notebook/u1/question.webp",
        solutionStorageKey: "notebook/u1/solution.webp",
      }),
    ).toEqual(["notebook/u1/question.webp", "notebook/u1/solution.webp"]);
  });

  it("keeps a solution photo on an entry that never had a question photo", () => {
    // A text-only mistake whose answer was photographed — the case a `storageKey`-only query drops.
    expect(
      notebookEntryImageKeys({
        storageKey: null,
        solutionStorageKey: "notebook/u1/solution.webp",
      }),
    ).toEqual(["notebook/u1/solution.webp"]);
  });

  it("keeps a question photo on an entry with no solution yet", () => {
    expect(
      notebookEntryImageKeys({
        storageKey: "notebook/u1/question.webp",
        solutionStorageKey: null,
      }),
    ).toEqual(["notebook/u1/question.webp"]);
  });

  it("returns nothing for a text-only entry", () => {
    expect(
      notebookEntryImageKeys({ storageKey: null, solutionStorageKey: null }),
    ).toEqual([]);
  });
});
