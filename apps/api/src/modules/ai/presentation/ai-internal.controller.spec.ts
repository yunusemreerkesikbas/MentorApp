import { describe, expect, it, vi } from "vitest";

import { AiInternalController } from "./ai-internal.controller";

describe("AiInternalController", () => {
  it("runs the structured-memory cleanup idempotently", async () => {
    const cleanupExpired = vi.fn(async () => 3);
    const controller = new AiInternalController({ cleanupExpired } as never);

    await expect(controller.cleanupCoachMemory()).resolves.toEqual({
      deleted: 3,
    });
    expect(cleanupExpired).toHaveBeenCalledOnce();
  });
});
