import { describe, expect, it } from "vitest";
import { RefreshMemoryHandler } from "./refresh-memory.handler";

const USER = "11111111-1111-4111-8111-111111111111";

describe("RefreshMemoryHandler", () => {
  const handler = new RefreshMemoryHandler();

  it("validates and completes a legacy queued job without side effects", async () => {
    await expect(handler.handle({ userId: USER })).resolves.toBeUndefined();
  });

  it("rejects malformed legacy payloads", async () => {
    await expect(handler.handle({ userId: "invalid" })).rejects.toThrow();
  });
});
