import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiErasureService } from "./ai-erasure.service";

const USER = "11111111-1111-4111-8111-111111111111";

describe("AiErasureService", () => {
  let deleteConversations: ReturnType<typeof vi.fn>;
  let deleteMemory: ReturnType<typeof vi.fn>;
  let deleteMemoryFacts: ReturnType<typeof vi.fn>;
  let deleteProfile: ReturnType<typeof vi.fn>;
  let deleteWeekly: ReturnType<typeof vi.fn>;
  let deleteGreetings: ReturnType<typeof vi.fn>;
  let service: AiErasureService;

  beforeEach(() => {
    deleteConversations = vi.fn(async () => undefined);
    deleteMemory = vi.fn(async () => undefined);
    deleteMemoryFacts = vi.fn(async () => undefined);
    deleteProfile = vi.fn(async () => undefined);
    deleteWeekly = vi.fn(async () => undefined);
    deleteGreetings = vi.fn(async () => undefined);
    service = new AiErasureService(
      { deleteAllForUser: deleteConversations } as never,
      { deleteAllForUser: deleteMemory } as never,
      { clear: deleteMemoryFacts } as never,
      { deleteAllForUser: deleteProfile } as never,
      { deleteAllForUser: deleteWeekly } as never,
      { deleteAllForUser: deleteGreetings } as never,
    );
  });

  it("erases threads, both memory stores, mentor profile, and AI caches", async () => {
    await service.eraseUserData(USER);

    expect(deleteConversations).toHaveBeenCalledWith(USER);
    expect(deleteMemory).toHaveBeenCalledWith(USER);
    expect(deleteMemoryFacts).toHaveBeenCalledWith(USER);
    expect(deleteProfile).toHaveBeenCalledWith(USER);
    expect(deleteWeekly).toHaveBeenCalledWith(USER);
    expect(deleteGreetings).toHaveBeenCalledWith(USER);
  });

  it("is idempotent — a second run is another clean no-op pass", async () => {
    await service.eraseUserData(USER);
    await service.eraseUserData(USER);

    expect(deleteConversations).toHaveBeenCalledTimes(2);
  });

  it("propagates a failure instead of silently half-erasing", async () => {
    deleteMemory.mockRejectedValue(new Error("db down"));

    await expect(service.eraseUserData(USER)).rejects.toThrow("db down");
  });
});
