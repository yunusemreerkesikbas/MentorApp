import { Module } from "@nestjs/common";
import { ForumService } from "./application/forum.service";
import { ForumThreadService } from "./application/forum-thread.service";
import { ForumZoneRepository } from "./infrastructure/forum-zone.repository";
import { ForumThreadRepository } from "./infrastructure/forum-thread.repository";
import { ForumController } from "./presentation/forum.controller";
import { ForumThreadController } from "./presentation/forum-thread.controller";

/**
 * Forum/community (Phase-2 pulled into MVP — design 2026-06-22). Slice 1: Zone + scoped membership
 * (curated staff creation, external OWNER, OPEN/REQUEST join). Slice 2: flat feed (threads) +
 * reactions + pin for CHAT/ANNOUNCEMENT. All behind `forum.enabled`. Later slices add QA/search and
 * report→moderation. `ConfigRegistryService` is global.
 */
@Module({
  controllers: [ForumController, ForumThreadController],
  providers: [ForumService, ForumThreadService, ForumZoneRepository, ForumThreadRepository],
  exports: [ForumService, ForumThreadService],
})
export class ForumModule {}
