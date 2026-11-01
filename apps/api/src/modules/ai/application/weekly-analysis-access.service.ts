import { Injectable, type OnModuleInit } from "@nestjs/common";
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
  ) {}

  onModuleInit(): void {
    this.registry.register({
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
