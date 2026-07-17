import { Injectable } from "@nestjs/common";
import type { AdminAiCostDto } from "@mentor/types";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import { AiBudgetGuard } from "./ai-budget.guard";

const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_SPENDERS_LIMIT = 10;

/**
 * Admin AI cost visibility (§7): aggregates the `ai_usage` meter into rolling-window totals, a
 * per-model + per-feature breakdown, top spenders, and the monthly budget status. Read-only,
 * cross-tenant (SERVICE ctx inside the repo). Cost is micro-USD as stored — the admin UI formats to USD.
 */
@Injectable()
export class AiCostStatsService {
  constructor(
    private readonly usage: AiUsageRepository,
    private readonly budget: AiBudgetGuard,
  ) {}

  async getCostStats(): Promise<AdminAiCostDto> {
    const now = Date.now();
    const since = (days: number) => new Date(now - days * DAY_MS);

    const [d1, d7, d30, byModel, byFeature, topSpenders, budget] = await Promise.all([
      this.usage.windowSince(since(1)),
      this.usage.windowSince(since(7)),
      this.usage.windowSince(since(30)),
      this.usage.byModelSince(since(30)),
      this.usage.byFeatureSince(since(30)),
      this.usage.topSpendersSince(since(30), TOP_SPENDERS_LIMIT),
      this.budget.getStatus(),
    ]);

    return {
      windows: { d1, d7, d30 },
      byModel,
      byFeature,
      topSpenders,
      budget,
      generatedAt: new Date(now).toISOString(),
    };
  }
}
