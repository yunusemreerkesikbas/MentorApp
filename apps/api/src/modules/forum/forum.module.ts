import { Module } from "@nestjs/common";
import { CronSecretGuard } from "../../common/auth/cron-secret.guard";
import { IdentityModule } from "../identity/identity.module";
import { ForumService } from "./application/forum.service";
import { ForumThreadService } from "./application/forum-thread.service";
import { ForumQaService } from "./application/forum-qa.service";
import { ForumModerationService } from "./application/forum-moderation.service";
import { ForumPublicService } from "./application/forum-public.service";
import { ForumMentionService } from "./application/forum-mention.service";
import { ForumErasureService } from "./application/forum-erasure.service";
import { ForumDiscoveryService } from "./application/forum-discovery.service";
import { ForumCoachBridgeService } from "./application/forum-coach-bridge.service";
import { ForumDiscoveryRepository } from "./infrastructure/forum-discovery.repository";
import { ForumErasureRepository } from "./infrastructure/forum-erasure.repository";
import { ForumZoneRepository } from "./infrastructure/forum-zone.repository";
import { ForumZoneSeedService } from "./infrastructure/forum-zone-seed.service";
import { ForumMaintenanceService } from "./application/forum-maintenance.service";
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
import { ForumDiscoveryController } from "./presentation/forum-discovery.controller";

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
    ForumDiscoveryController,
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
    ForumZoneSeedService,
    ForumMaintenanceService,
    ForumThreadRepository,
    ForumPostRepository,
    ForumAttachmentRepository,
    ForumBookmarkRepository,
    ForumReportRepository,
    ForumErasureRepository,
    ForumErasureService,
    ForumDiscoveryService,
    ForumCoachBridgeService,
    ForumDiscoveryRepository,
  ],
  exports: [
    ForumService,
    ForumThreadService,
    ForumQaService,
    ForumErasureService,
    ForumDiscoveryService,
    ForumCoachBridgeService,
  ],
})
export class ForumModule {}
