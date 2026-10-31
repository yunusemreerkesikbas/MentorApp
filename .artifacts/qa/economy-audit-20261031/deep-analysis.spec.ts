import { describe, expect, it } from "vitest";
import { DeepAnalysisService } from "../../../apps/api/src/modules/economy/application/deep-analysis.service";
import { WeeklyReviewNarrationService } from "../../../apps/api/src/modules/ai/application/weekly-review-narration.service";

describe("Economy audit diagnostic reproductions", () => {
  it("reproduces a debit for a deep-analysis unlock while AI is disabled", async () => {
    const refs = new Set<string>();
    const queried: string[] = [];
    let coin = 30;
    const config = { get: async (key: string) => {
      queried.push(key);
      if (key === "economy.coin.deep_analysis_cost") return 25;
      return false;
    } };
    const service = new DeepAnalysisService(
      { getSelfBalance: async () => ({ coinConfirmed: coin }), spend: async (_u: string, cost: number, opts: { refId: string }) => { coin -= cost; refs.add(opts.refId); } } as never,
      { existsByRef: async (_type: string, ref: string) => refs.has(ref) } as never,
      { getReview: async () => ({ status: "READY", period: { startDate: "2026-10-19" } }) } as never,
      { getEntitlement: async () => ({ isPremium: false }) } as never,
      config as never,
    );
    expect(await service.purchase("u1", [], "exam")).toMatchObject({ unlocked: true, coinConfirmed: 5 });
    expect(queried).not.toContain("ai.enabled");
    const narration = new WeeklyReviewNarrationService(
      {} as never, config as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never,
    );
    await expect(narration.narrate({ id: "u1", roles: [], orgId: null }, "exam")).rejects.toMatchObject({ code: "AI_DISABLED" });
    console.log("REPRO: 25 Coin debited and unlock persisted, then narration refuses AI_DISABLED.");
  });
});
