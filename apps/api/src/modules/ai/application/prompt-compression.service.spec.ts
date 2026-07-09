import { beforeEach, describe, expect, it, vi } from "vitest";
import { PromptCompressionService } from "./prompt-compression.service";

describe("PromptCompressionService", () => {
  let service: PromptCompressionService;
  let compress: ReturnType<typeof vi.fn>;
  let configGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    compress = vi.fn();
    configGet = vi.fn(async (key: string) => {
      if (key === "ai.compression.enabled") return true;
      return undefined;
    });

    service = new PromptCompressionService(
      { compress } as never,
      { get: configGet } as never,
      {
        get: vi.fn((key: string) => {
          if (key === "HEADROOM_PROXY_URL") return "http://localhost:8787";
          if (key === "OPENAI_MODEL") return "gpt-4o-mini";
          return undefined;
        }),
      } as never,
    );
  });

  it("passes through when compression flag is off", async () => {
    configGet.mockImplementation(async (key: string) => key === "ai.compression.enabled" && false);

    const result = await service.maybeCompress({
      systemCore: "core",
      ragBlock: "RAG verbatim",
      user: "hello",
    });

    expect(result).toEqual({ system: "core\n\nRAG verbatim", user: "hello" });
    expect(compress).not.toHaveBeenCalled();
  });

  it("keeps RAG block verbatim after compression", async () => {
    compress.mockResolvedValue({
      messages: [
        { role: "system", content: "compressed-core" },
        { role: "user", content: "compressed-user" },
      ],
      tokensBefore: 1000,
      tokensAfter: 200,
      tokensSaved: 800,
      compressionRatio: 0.8,
      compressed: true,
    });

    const result = await service.maybeCompress({
      systemCore: "core",
      ragBlock: "KAYNAK MAKALELER: article",
      user: "hello",
    });

    expect(result.system).toBe("compressed-core\n\nKAYNAK MAKALELER: article");
    expect(result.user).toBe("compressed-user");
    expect(result.compression?.tokensSaved).toBe(800);
  });

  it("falls back to uncompressed when compression throws", async () => {
    compress.mockRejectedValue(new Error("proxy down"));

    const result = await service.maybeCompress({
      systemCore: "core",
      ragBlock: null,
      user: "hello",
    });

    expect(result).toEqual({ system: "core", user: "hello" });
  });
});
