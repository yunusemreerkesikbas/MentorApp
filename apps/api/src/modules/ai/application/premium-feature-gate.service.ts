import { HttpStatus, Injectable } from "@nestjs/common";
import { PremiumFeatureId, type PremiumFeatureId as FeatureId } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import type { ConfigKey } from "../../../common/config/config.catalog";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { EntitlementService } from "../../payments/application/entitlement.service";
import {
  evaluateFeatureAccess,
  FEATURE_WINDOW_MS,
  PREMIUM_FEATURE_CATALOG,
} from "../../payments/domain/feature-access";
import { AiUsageFeature } from "../domain/ai.constants";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";

const USAGE_FEATURES: Record<FeatureId, string[]> = {
  [PremiumFeatureId.COACH_CHAT]: [AiUsageFeature.CHAT],
  [PremiumFeatureId.PHOTO_CATEGORIZE]: [AiUsageFeature.VISION],
  [PremiumFeatureId.PLAN_AI]: [
    AiUsageFeature.PLAN_DRAFT,
    AiUsageFeature.PLAN_ADAPTATION,
  ],
  [PremiumFeatureId.MOOD_REFLECTION]: [AiUsageFeature.MOOD],
  [PremiumFeatureId.GHOST_NARRATION]: [AiUsageFeature.GHOST],
  [PremiumFeatureId.VISION_NOTE]: [AiUsageFeature.VISION_NOTE],
  [PremiumFeatureId.SESSION_REFLECTION]: [AiUsageFeature.SESSION_REFLECTION],
  [PremiumFeatureId.WEEKLY_NARRATION]: [AiUsageFeature.WEEKLY_REVIEW],
  [PremiumFeatureId.DAILY_GREETING]: [AiUsageFeature.DAILY_GREETING],
  [PremiumFeatureId.DEEP_ANALYSIS]: [AiUsageFeature.WEEKLY_REVIEW],
};

@Injectable()
export class PremiumFeatureGateService {
  constructor(
    private readonly entitlement: EntitlementService,
    private readonly config: ConfigRegistryService,
    private readonly usage: AiUsageRepository,
  ) {}

  async isAllowed(
    userId: string,
    roles: string[] | undefined,
    featureId: FeatureId,
  ): Promise<boolean> {
    const ent = await this.entitlement.getEntitlement(userId, roles);
    if (ent.isPremium) return true;

    const meta = PREMIUM_FEATURE_CATALOG[featureId];
    const [freeEnabled, freeLimit] = await Promise.all([
      this.config.get(meta.enabledKey as ConfigKey),
      this.config.get(meta.limitKey as ConfigKey),
    ]);
    if (!freeEnabled) return false;

    const used = await this.usage.countFeaturesSince(
      userId,
      USAGE_FEATURES[featureId],
      new Date(Date.now() - FEATURE_WINDOW_MS[meta.window]),
    );
    return evaluateFeatureAccess({
      isPremium: false,
      freeEnabled: Boolean(freeEnabled),
      used,
      freeLimit: Number(freeLimit),
    }).allowed;
  }

  async assertAllowed(
    userId: string,
    roles: string[] | undefined,
    featureId: FeatureId,
  ): Promise<void> {
    if (await this.isAllowed(userId, roles, featureId)) return;
    throw new DomainError(ErrorCode.PAYMENT_PREMIUM_REQUIRED, HttpStatus.FORBIDDEN);
  }
}
