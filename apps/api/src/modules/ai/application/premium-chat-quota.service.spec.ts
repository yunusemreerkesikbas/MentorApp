import { describe, expect, it, vi } from "vitest";
import { PremiumChatQuotaService } from "./premium-chat-quota.service";

describe("PremiumChatQuotaService", () => {
  it("uses both configured windows for the probe and the atomic admission", async () => {
    const read = vi.fn(async () => ({
      dailyRemaining: 12,
      monthlyRemaining: 0,
      retryAt: "2026-11-08T10:00:00.000Z",
    }));
    const reserve = vi.fn(async () => ({ status: await read() }));
    const service = new PremiumChatQuotaService(
      { get: async (key: string) => key === "ai.chat.daily_limit" ? 20 : 100 } as never,
      { read, reserve } as never,
    );

    await expect(service.read("user")).resolves.toMatchObject({ monthlyRemaining: 0 });
    await expect(service.admit("user")).rejects.toMatchObject({
      code: "AI_CHAT_QUOTA_EXCEEDED",
      httpStatus: 429,
      details: { retryAt: "2026-11-08T10:00:00.000Z" },
    });
    expect(read).toHaveBeenCalledWith("user", { daily: 20, monthly: 100 });
    expect(reserve).toHaveBeenCalledWith("user", { daily: 20, monthly: 100 });
  });
});
