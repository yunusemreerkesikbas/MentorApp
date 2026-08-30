import { Module } from "@nestjs/common";
import { PromotionsService } from "./application/promotions.service";
import { PromotionRedemptionRepository } from "./infrastructure/promotion-redemption.repository";
import { PromotionRepository } from "./infrastructure/promotion.repository";

/**
 * Promotions (W4) — coupons, campaigns, automatic discounts.
 *
 * Deliberately imports NOTHING. Payments depends on this module, not the other way round: every
 * signal a rule needs (registration date, prior subscriptions, studied days) is passed in by the
 * caller, so there is no cycle and no cross-context table read.
 */
@Module({
  providers: [PromotionsService, PromotionRepository, PromotionRedemptionRepository],
  exports: [PromotionsService],
})
export class PromotionsModule {}
