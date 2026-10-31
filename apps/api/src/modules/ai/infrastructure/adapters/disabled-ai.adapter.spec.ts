import { afterEach, describe, expect, it, vi } from "vitest";
import { DisabledAiAdapter } from "./disabled-ai.adapter";

afterEach(() => vi.unstubAllGlobals());

describe("DisabledAiAdapter", () => {
  it("rejects all operations with the stable disabled error and never fetches", async () => {
    const fetch = vi.fn(() => { throw new Error("Unexpected provider request"); });
    vi.stubGlobal("fetch", fetch);
    const adapter = new DisabledAiAdapter();
    const denial = { code: "AI_DISABLED", httpStatus: 404 };
    await expect(adapter.complete({ system: "fixture", user: "fixture" })).rejects.toMatchObject(denial);
    await expect(adapter.embed("editorial")).rejects.toMatchObject(denial);
    await expect(adapter.completeStream({ system: "fixture", user: "fixture" })[Symbol.asyncIterator]().next())
      .rejects.toMatchObject(denial);
    await expect(adapter.categorizeImage({ imageBytes: Buffer.from("fixture"), mimeType: "image/png",
      allowedSubjects: [], allowedTopics: [] })).rejects.toMatchObject(denial);
    expect(fetch).not.toHaveBeenCalled();
  });
});
