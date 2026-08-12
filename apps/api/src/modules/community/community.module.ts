import { Module } from "@nestjs/common";
import { CoachingModule } from "../coaching/coaching.module";
import { EconomyModule } from "../economy/economy.module";
import { ForumModule } from "../forum/forum.module";
import { IdentityModule } from "../identity/identity.module";
import { PaymentsModule } from "../payments/payments.module";
import { BuddyViewService } from "./application/buddy-view.service";
import { CommunityService } from "./application/community.service";
import { BuddyController } from "./presentation/buddy.controller";
import { CommunityController } from "./presentation/community.controller";

/**
 * Community — the right-column "Emek Panosu" (effort board): streak + XP + weekly effort leaderboard
 * + positive badges. Pure aggregation module: it owns no tables, composing reads from the public
 * services of identity (profile), coaching (streak), forum (post signals), and economy (XP/leaderboard).
 * `ConfigRegistryService` is global.
 */
@Module({
  imports: [IdentityModule, CoachingModule, ForumModule, EconomyModule, PaymentsModule],
  controllers: [CommunityController, BuddyController],
  providers: [CommunityService, BuddyViewService],
})
export class CommunityModule {}
