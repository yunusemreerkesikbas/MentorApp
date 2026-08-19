import { Module } from "@nestjs/common";
import { CoachingModule } from "../coaching/coaching.module";
import { EconomyModule } from "../economy/economy.module";
import { ForumModule } from "../forum/forum.module";
import { IdentityModule } from "../identity/identity.module";
import { PaymentsModule } from "../payments/payments.module";
import { BuddyViewService } from "./application/buddy-view.service";
import { AchievementService } from "./application/achievement.service";
import { AchievementEventsListener } from "./application/achievement-events.listener";
import { AchievementBackfillService } from "./application/achievement-backfill.service";
import { CommunityService } from "./application/community.service";
import { AchievementRepository } from "./infrastructure/achievement.repository";
import { BuddyController } from "./presentation/buddy.controller";
import { CommunityController } from "./presentation/community.controller";

/**
 * Community — the right-column "Emek Panosu" (effort board): streak + XP + weekly effort leaderboard
 * + positive badges and the permanent achievement collection. It owns only `user_achievements`;
 * every other read is composed from public services/events of identity, coaching, forum and economy.
 * `ConfigRegistryService` is global.
 */
@Module({
  imports: [IdentityModule, CoachingModule, ForumModule, EconomyModule, PaymentsModule],
  controllers: [CommunityController, BuddyController],
  providers: [
    CommunityService,
    BuddyViewService,
    AchievementService,
    AchievementEventsListener,
    AchievementBackfillService,
    AchievementRepository,
  ],
  exports: [AchievementService, AchievementBackfillService],
})
export class CommunityModule {}
