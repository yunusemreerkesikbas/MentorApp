import { Injectable, Optional, type OnModuleInit } from "@nestjs/common";
import { WeeklyRecapService } from "./weekly-recap.service";
import { PremiumFeatureId } from "@mentor/types";
import { WeeklyAnalysisAccessRegistry } from "../../economy/application/weekly-analysis-access.registry";
import { AiBudgetGuard } from "./ai-budget.guard";
import { PremiumFeatureGateService } from "./premium-feature-gate.service";

/** One capped Free policy for the weekly Coin offer and the narration that it unlocks. */
@Injectable()
export class WeeklyAnalysisAccessService implements OnModuleInit {
  constructor(
    private readonly registry: WeeklyAnalysisAccessRegistry,
    private readonly featureGate: PremiumFeatureGateService,
    private readonly budget: AiBudgetGuard,
    @Optional() private readonly recaps?: WeeklyRecapService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      recapState: async (userId, roles, examId) => {
        const offer = await this.recaps!.offer({ id: userId, roles, orgId: null, sessionId: "" }, examId);
        return {
          eligible: offer.ready, weekStart: offer.ready ? offer.weekStart : null,
          cost: offer.cost, coinConfirmed: offer.coinConfirmed, canAfford: offer.coinConfirmed >= offer.cost,
          unlocked: offer.mode !== "COIN" && offer.mode !== "NONE", premium: offer.premium,
          purchased: offer.mode === "OWNED",
          generationAvailable: offer.canOpen || offer.reason === "INSUFFICIENT_COIN",
          purchaseAvailable: offer.mode === "COIN" && (offer.canOpen || offer.reason === "INSUFFICIENT_COIN"),
          limitReached: offer.reason === "WEEKLY_RECAP_LIMIT_REACHED",
        };
      },
      isIncluded: (userId, roles) => this.isIncluded(userId, roles),
      canGenerate: () => this.budget.hasCapacity(),
      acquire: () => this.budget.acquire(),
      release: (id) => this.budget.release(id),
    });
  }

  isIncluded(userId: string, roles: string[]): Promise<boolean> {
    return this.featureGate.isAllowed(
      userId,
      roles,
      PremiumFeatureId.WEEKLY_NARRATION,
    );
  }
}
