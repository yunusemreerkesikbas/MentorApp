import { describe, expect, it, vi } from "vitest";
import { AiCostStatsService } from "./ai-cost-stats.service";

describe("AiCostStatsService", () => {
  it("aggregates rolling windows, per-model, and top spenders", async () => {
    const windowSince = vi.fn(async (since: Date) => {
      // Newer windows (smaller lookback) return smaller totals — assert they map to d1/d7/d30.
      const days = Math.round((Date.now() - since.getTime()) / (24 * 60 * 60 * 1000));
      return { costMicros: days, calls: days, promptTokens: days * 10, completionTokens: days * 5 };
    });
    const byModelSince = vi.fn(async () => [
      { model: "gpt-4o-mini", costMicros: 900, calls: 30, promptTokens: 3000, completionTokens: 1500 },
    ]);
    const byFeatureSince = vi.fn(async () => [
      { feature: "chat", costMicros: 700, calls: 20, promptTokens: 2000, completionTokens: 1000 },
      { feature: "vision", costMicros: 200, calls: 10, promptTokens: 1000, completionTokens: 500 },
    ]);
    const topSpendersSince = vi.fn(async () => [
      { userId: "u1", email: "a@x.io", displayName: "Ada", costMicros: 500, calls: 12 },
    ]);

    const budget = { getStatus: vi.fn(async () => ({ capMicros: 0, spentMicros: 100, exceeded: false })) };
    const service = new AiCostStatsService(
      { windowSince, byModelSince, byFeatureSince, topSpendersSince } as never,
      budget as never,
    );

    const stats = await service.getCostStats();

    expect(stats.budget.exceeded).toBe(false);
    expect(stats.windows.d1.calls).toBe(1);
    expect(stats.windows.d7.calls).toBe(7);
    expect(stats.windows.d30.calls).toBe(30);
    expect(stats.byModel[0]?.model).toBe("gpt-4o-mini");
    expect(stats.byFeature.map((f) => f.feature)).toEqual(["chat", "vision"]);
    expect(stats.topSpenders[0]?.email).toBe("a@x.io");
    expect(topSpendersSince).toHaveBeenCalledWith(expect.any(Date), 10);
    expect(typeof stats.generatedAt).toBe("string");
  });
});
