import { Module } from "@nestjs/common";
import { EconomyModule } from "../economy/economy.module";
import { IdentityModule } from "../identity/identity.module";
import { PaymentsModule } from "../payments/payments.module";
import { AdsErasureService } from "./application/ads-erasure.service";
import { AdsService } from "./application/ads.service";
import { AdsStatsService } from "./application/ads-stats.service";
import { AdRewardSessionRepository } from "./infrastructure/ad-reward-session.repository";
import { AdsController } from "./presentation/ads.controller";

@Module({
  imports: [EconomyModule, IdentityModule, PaymentsModule],
  controllers: [AdsController],
  providers: [AdsService, AdsStatsService, AdsErasureService, AdRewardSessionRepository],
  exports: [AdsStatsService, AdsErasureService],
})
export class AdsModule {}
