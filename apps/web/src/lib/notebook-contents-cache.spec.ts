import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotebookContentsDto } from "@mentor/types";

const fetchNotebookContents = vi.fn<(notebookId?: string) => Promise<NotebookContentsDto>>();
vi.mock("./notebook", () => ({
  fetchNotebookContents: (notebookId?: string) => fetchNotebookContents(notebookId),
}));

const {
  forgetAllNotebookContents,
  forgetNotebookContents,
  prefetchNotebookContents,
} = await import("./notebook-contents-cache");

function contents(notebookId: string): NotebookContentsDto {
  return { notebookId, pages: [] };
}

describe("notebook contents cache", () => {
  beforeEach(() => {
    forgetAllNotebookContents();
    fetchNotebookContents.mockReset();
    fetchNotebookContents.mockImplementation(async (id) => contents(id ?? "mistake"));
  });

  it("shares one read per notebook while it is fresh", async () => {
    const first = prefetchNotebookContents("a");
    const second = prefetchNotebookContents("a");
    expect(second).toBe(first);
    await expect(first).resolves.toEqual(contents("a"));
    expect(fetchNotebookContents).toHaveBeenCalledTimes(1);
  });

  it("reads one notebook again after its page was written", async () => {
    await prefetchNotebookContents("a");
    await prefetchNotebookContents("b");
    forgetNotebookContents("a");
    await prefetchNotebookContents("a");
    await prefetchNotebookContents("b");
    expect(fetchNotebookContents.mock.calls.map(([id]) => id)).toEqual(["a", "b", "a"]);
  });

  it("serves nothing it cached to the next student signed in", async () => {
    await prefetchNotebookContents(undefined);
    forgetAllNotebookContents();
    await prefetchNotebookContents(undefined);
    expect(fetchNotebookContents).toHaveBeenCalledTimes(2);
  });

  it("does not hand a failed read to the next caller", async () => {
    fetchNotebookContents.mockRejectedValueOnce(new Error("offline"));
    await expect(prefetchNotebookContents("a")).rejects.toThrow("offline");
    await expect(prefetchNotebookContents("a")).resolves.toEqual(contents("a"));
    expect(fetchNotebookContents).toHaveBeenCalledTimes(2);
  });
});
