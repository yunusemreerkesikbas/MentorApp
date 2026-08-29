import { Module } from "@nestjs/common";
import { ContentModule } from "../content/content.module";
import { EconomyModule } from "../economy/economy.module";
import { IdentityModule } from "../identity/identity.module";
import { PaymentsModule } from "../payments/payments.module";
import { AdsErasureService } from "./application/ads-erasure.service";
import { AdsMaintenanceService } from "./application/ads-maintenance.service";
import { AdsService } from "./application/ads.service";
import { AdsStatsService } from "./application/ads-stats.service";
import { AdRewardSessionRepository } from "./infrastructure/ad-reward-session.repository";
import { AdsController } from "./presentation/ads.controller";
import { AdsInternalController } from "./presentation/ads-internal.controller";

@Module({
  imports: [ContentModule, EconomyModule, IdentityModule, PaymentsModule],
  controllers: [AdsController, AdsInternalController],
  providers: [
    AdsService,
    AdsStatsService,
    AdsErasureService,
    AdsMaintenanceService,
    AdRewardSessionRepository,
  ],
  exports: [AdsStatsService, AdsErasureService],
})
export class AdsModule {}
