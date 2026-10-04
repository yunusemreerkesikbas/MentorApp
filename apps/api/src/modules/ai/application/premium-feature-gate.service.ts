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
  [PremiumFeatureId.MENTORSHIP_BRIEF]: [AiUsageFeature.MENTORSHIP_BRIEF],
  // Deliberately NOT sharing a quota with MENTORSHIP_BRIEF: the cohort view is how a coach decides
  // which student to open, so paying for it out of the per-student allowance would ration the map
  // by how much of the territory you already walked.
  [PremiumFeatureId.MENTORSHIP_COHORT_BRIEF]: [
    AiUsageFeature.MENTORSHIP_COHORT_BRIEF,
  ],
  [PremiumFeatureId.MENTORSHIP_SUGGESTIONS]: [AiUsageFeature.MENTORSHIP_SUGGESTIONS],
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
    return (await this.access(userId, roles, featureId)) === "ALLOWED";
  }

  /**
   * `limitCode` replaces `PAYMENT_PREMIUM_REQUIRED` when the refusal is a used-up free taste. The
   * coach AI surfaces pass one: a coach has no Premium to buy, so "open on Premium" would send them
   * nowhere. With no taste switched on the refusal stays the Premium one.
   */
  async assertAllowed(
    userId: string,
    roles: string[] | undefined,
    featureId: FeatureId,
    limitCode?: ErrorCode,
  ): Promise<void> {
    const access = await this.access(userId, roles, featureId);
    if (access === "ALLOWED") return;
    const code =
      access === "FREE_LIMIT_REACHED" && limitCode ? limitCode : ErrorCode.PAYMENT_PREMIUM_REQUIRED;
    throw new DomainError(code, HttpStatus.FORBIDDEN);
  }

  private async access(
    userId: string,
    roles: string[] | undefined,
    featureId: FeatureId,
  ): Promise<"ALLOWED" | "PREMIUM_REQUIRED" | "FREE_LIMIT_REACHED"> {
    const ent = await this.entitlement.getEntitlement(userId, roles);
    if (ent.isPremium) return "ALLOWED";

    const meta = PREMIUM_FEATURE_CATALOG[featureId];
    const [freeEnabled, freeLimit] = await Promise.all([
      this.config.get(meta.enabledKey as ConfigKey),
      this.config.get(meta.limitKey as ConfigKey),
    ]);
    if (!freeEnabled) return "PREMIUM_REQUIRED";

    const used = await this.usage.countFeaturesSince(
      userId,
      USAGE_FEATURES[featureId],
      new Date(Date.now() - FEATURE_WINDOW_MS[meta.window]),
    );
    return evaluateFeatureAccess({
      isPremium: false,
      freeEnabled: true,
      used,
      freeLimit: Number(freeLimit),
    }).allowed
      ? "ALLOWED"
      : "FREE_LIMIT_REACHED";
  }
}
