import { Module } from "@nestjs/common";
import { ForumService } from "./application/forum.service";
import { ForumZoneRepository } from "./infrastructure/forum-zone.repository";
import { ForumController } from "./presentation/forum.controller";

/**
 * Forum/community (Phase-2 pulled into MVP — design 2026-06-22). Slice 1: Zone + scoped membership
 * (curated staff creation, external OWNER, OPEN/REQUEST join) behind `forum.enabled`. Later slices
 * add threads/posts/reactions/QA/search and report→moderation. `ConfigRegistryService` is global.
 */
@Module({
  controllers: [ForumController],
  providers: [ForumService, ForumZoneRepository],
  exports: [ForumService],
})
export class ForumModule {}
