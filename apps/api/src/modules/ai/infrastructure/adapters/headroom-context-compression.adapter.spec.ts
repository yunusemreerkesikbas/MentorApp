import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeadroomContextCompressionAdapter } from "./headroom-context-compression.adapter";

describe("HeadroomContextCompressionAdapter", () => {
  let adapter: HeadroomContextCompressionAdapter;

  beforeEach(() => {
    adapter = new HeadroomContextCompressionAdapter({
      get: vi.fn((key: string) =>
        key === "HEADROOM_PROXY_URL" ? "http://localhost:8787" : undefined,
      ),
    } as never);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("calls /v1/compress and maps the response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        messages: [{ role: "system", content: "small" }],
        tokens_before: 500,
        tokens_after: 100,
        tokens_saved: 400,
        compression_ratio: 0.8,
      }),
    } as Response);

    const result = await adapter.compress({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: "large prompt" }],
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8787/v1/compress",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.tokensSaved).toBe(400);
    expect(result.messages[0]?.content).toBe("small");
    expect(result.compressed).toBe(true);
  });
});
