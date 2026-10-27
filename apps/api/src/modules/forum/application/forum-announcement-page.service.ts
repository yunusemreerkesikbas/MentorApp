import { Injectable } from "@nestjs/common";
import type { AnnouncementAdSnapshot, ThreadDetail } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ForumZoneRepository } from "../infrastructure/forum-zone.repository";
import { ForumService } from "./forum.service";
import { ForumThreadService, type ThreadActor } from "./forum-thread.service";
import { buildAnnouncementAdSnapshot } from "./announcement-ad-snapshot";

@Injectable()
export class ForumAnnouncementPageService {
  constructor(private readonly threads: ForumThreadService, private readonly forum: ForumService,
    private readonly zones: ForumZoneRepository, private readonly config: ConfigRegistryService) {}

  async getDetail(actor: ThreadActor, threadId: string): Promise<ThreadDetail> {
    const [detail, enabled] = await Promise.all([this.threads.getThreadDetail(actor.id, threadId, actor.roles),
      this.config.get("ads.placement.community_announcement_end.enabled").catch(() => false)]);
    if (!enabled) return detail;
    try {
      const snapshot = await this.snapshot(actor, detail);
      return snapshot ? { ...detail, adContext: { contentRevision: snapshot.contentRevision, sidebarRooms: snapshot.sidebarRooms, zone: snapshot.zone } } : detail;
    } catch { return detail; }
  }

  async getReviewSnapshot(actor: ThreadActor, threadId: string): Promise<AnnouncementAdSnapshot | null> {
    try { return await this.snapshot(actor, await this.threads.getThreadDetail(actor.id, threadId, actor.roles)); }
    catch (error) {
      if (error instanceof DomainError && [403, 404].includes(error.httpStatus)) return null;
      throw error;
    }
  }

  private async snapshot(actor: ThreadActor, detail: ThreadDetail) {
    const sidebar = await this.forum.listZones(actor.id, actor.roles, { page: 1, pageSize: 100 });
    if (sidebar.total > sidebar.items.length) return null;
    const zone = sidebar.items.find((room) => room.id === detail.thread.zoneId);
    if (!zone || zone.type !== "ANNOUNCEMENT" || zone.visibility !== "PUBLIC" || zone.isArchived) return null;
    const ids = [...new Set([zone.id, ...sidebar.items.map((room) => room.id)])];
    const publicRooms = await this.zones.listPublicReviewZones(ids);
    return buildAnnouncementAdSnapshot(detail, zone, sidebar.items, publicRooms);
  }
}
