import { Module } from "@nestjs/common";
import { CronSecretGuard } from "../../common/auth/cron-secret.guard";
import { IdentityModule } from "../identity/identity.module";
import { ForumService } from "./application/forum.service";
import { ForumThreadService } from "./application/forum-thread.service";
import { ForumQaService } from "./application/forum-qa.service";
import { ForumModerationService } from "./application/forum-moderation.service";
import { ForumPublicService } from "./application/forum-public.service";
import { ForumMentionService } from "./application/forum-mention.service";
import { ForumZoneRepository } from "./infrastructure/forum-zone.repository";
import { ForumThreadRepository } from "./infrastructure/forum-thread.repository";
import { ForumPostRepository } from "./infrastructure/forum-post.repository";
import { ForumAttachmentRepository } from "./infrastructure/forum-attachment.repository";
import { ForumBookmarkRepository } from "./infrastructure/forum-bookmark.repository";
import { ForumReportRepository } from "./infrastructure/forum-report.repository";
import { ForumController } from "./presentation/forum.controller";
import { ForumThreadController } from "./presentation/forum-thread.controller";
import { ForumQaController } from "./presentation/forum-qa.controller";
import { ForumModerationController } from "./presentation/forum-moderation.controller";
import { ForumPublicController } from "./presentation/forum-public.controller";
import { ForumInternalController } from "./presentation/forum-internal.controller";

/**
 * Forum/community (Phase-2 pulled into MVP — design 2026-06-22). Slice 1: Zone + scoped membership.
 * Slice 2: flat feed (threads) + reactions + pin. Slice 3: QA (questions/answers/accept→XP/search).
 * Slice 5: reports → moderation queue (hide/restore/dismiss + audit). All behind `forum.enabled`.
 */
@Module({
  imports: [IdentityModule],
  controllers: [
    ForumController,
    ForumThreadController,
    ForumQaController,
    ForumModerationController,
    ForumPublicController,
    ForumInternalController,
  ],
  providers: [
    CronSecretGuard,
    ForumService,
    ForumThreadService,
    ForumQaService,
    ForumModerationService,
    ForumPublicService,
    ForumMentionService,
    ForumZoneRepository,
    ForumThreadRepository,
    ForumPostRepository,
    ForumAttachmentRepository,
    ForumBookmarkRepository,
    ForumReportRepository,
  ],
  exports: [ForumService, ForumThreadService, ForumQaService],
})
export class ForumModule {}
