import { Module } from "@nestjs/common";
import { ForumService } from "./application/forum.service";
import { ForumThreadService } from "./application/forum-thread.service";
import { ForumQaService } from "./application/forum-qa.service";
import { ForumZoneRepository } from "./infrastructure/forum-zone.repository";
import { ForumThreadRepository } from "./infrastructure/forum-thread.repository";
import { ForumPostRepository } from "./infrastructure/forum-post.repository";
import { ForumController } from "./presentation/forum.controller";
import { ForumThreadController } from "./presentation/forum-thread.controller";
import { ForumQaController } from "./presentation/forum-qa.controller";

/**
 * Forum/community (Phase-2 pulled into MVP — design 2026-06-22). Slice 1: Zone + scoped membership
 * (curated staff creation, external OWNER, OPEN/REQUEST join). Slice 2: flat feed (threads) +
 * reactions + pin for CHAT/ANNOUNCEMENT. All behind `forum.enabled`. Later slices add QA/search and
 * report→moderation. `ConfigRegistryService` is global.
 */
@Module({
  controllers: [ForumController, ForumThreadController, ForumQaController],
  providers: [
    ForumService,
    ForumThreadService,
    ForumQaService,
    ForumZoneRepository,
    ForumThreadRepository,
    ForumPostRepository,
  ],
  exports: [ForumService, ForumThreadService, ForumQaService],
})
export class ForumModule {}
