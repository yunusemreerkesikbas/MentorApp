import { Module } from "@nestjs/common";
import { CoachingModule } from "../coaching/coaching.module";
import { EconomyModule } from "../economy/economy.module";
import { ForumModule } from "../forum/forum.module";
import { IdentityModule } from "../identity/identity.module";
import { CommunityService } from "./application/community.service";
import { CommunityController } from "./presentation/community.controller";

/**
 * Community — the right-column "Emek Panosu" (effort board): streak + XP + weekly effort leaderboard
 * + positive badges. Pure aggregation module: it owns no tables, composing reads from the public
 * services of identity (profile), coaching (streak), forum (post signals), and economy (XP/leaderboard).
 * `ConfigRegistryService` is global.
 */
@Module({
  imports: [IdentityModule, CoachingModule, ForumModule, EconomyModule],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
