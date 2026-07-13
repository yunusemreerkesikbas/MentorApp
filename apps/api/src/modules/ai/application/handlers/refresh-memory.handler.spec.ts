import { beforeEach, describe, expect, it, vi } from "vitest";
import { RefreshMemoryHandler } from "./refresh-memory.handler";

const USER = "11111111-1111-4111-8111-111111111111";

describe("RefreshMemoryHandler", () => {
  let complete: ReturnType<typeof vi.fn>;
  let lastN: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;
  let upsert: ReturnType<typeof vi.fn>;
  let append: ReturnType<typeof vi.fn>;
  let handler: RefreshMemoryHandler;

  beforeEach(() => {
    complete = vi.fn(async () => ({
      text: "Hedefi: KPSS. Zorlandığı: paragraf.",
      model: "fake",
      promptTokens: 5,
      completionTokens: 3,
    }));
    lastN = vi.fn(async () => [
      { role: "USER", content: "Paragrafta zorlanıyorum" },
      { role: "COACH", content: "Birlikte çalışalım" },
    ]);
    get = vi.fn(async () => null);
    upsert = vi.fn(async () => undefined);
    append = vi.fn(async () => undefined);
    handler = new RefreshMemoryHandler(
      { complete } as never,
      { lastN } as never,
      { get, upsert } as never,
      { append } as never,
      { isWithinBudget: vi.fn(async () => true) } as never,
    );
  });

  it("distills a profile, upserts it, and meters the call as feature=memory", async () => {
    await handler.handle({ userId: USER });
    expect(complete).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledWith(USER, {
      summary: "Hedefi: KPSS. Zorlandığı: paragraf.",
      model: "fake",
      messageCount: 2,
    });
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ userId: USER, feature: "memory" }));
  });

  it("no-ops (no LLM call) when there is no history", async () => {
    lastN.mockResolvedValue([]);
    await handler.handle({ userId: USER });
    expect(complete).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("no-ops when the profile is already current for this message count", async () => {
    get.mockResolvedValue({ summary: "eski", model: "fake", messageCount: 2, updatedAt: new Date() });
    await handler.handle({ userId: USER });
    expect(complete).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
