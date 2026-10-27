import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ExamType, type ForumHubView, type ForumFeedItem } from "@mentor/types";
import { forumFeedQuerySchema } from "@mentor/validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { BuddyService } from "../../identity/application/buddy.service";
import { ForumZoneRepository } from "../infrastructure/forum-zone.repository";
import { ForumDiscoveryService } from "./forum-discovery.service";
import { ForumService } from "./forum.service";
import type { ThreadActor } from "./forum-thread.service";

/** Preparation only: operational approval does not certify Google's inventory-value requirements. */
@Injectable()
export class ForumHubPageService {
  constructor(private readonly discovery: ForumDiscoveryService, private readonly forum: ForumService,
    private readonly zones: ForumZoneRepository, private readonly buddy: BuddyService,
    private readonly config: ConfigRegistryService) {}

  private async gatesOpen() {
    const [enabled, reviewed] = await Promise.all([
      this.config.get("ads.placement.community_overview.enabled"),
      this.config.get("ads.placement.community_overview.review_approved"),
    ]).catch(() => [false, false]);
    return enabled && reviewed;
  }

  async getHub(actor: ThreadActor): Promise<ForumHubView> {
    const [hub, open] = await Promise.all([this.discovery.getHub(actor), this.gatesOpen()]);
    if (!open || !hub.featured || !hub.featured.body.trim() || !(hub.featured.commentCount >= 1) ||
      hub.continueDiscussions.length > 0) return hub;
    try {
      const [feed, sidebar, active, outgoing, incoming] = await Promise.all([
        this.discovery.getFeed(actor, forumFeedQuerySchema.parse({ scope: "relevant", sort: "recent", unanswered: "true", limit: 4 })),
        this.forum.listZones(actor.id, actor.roles, { page: 1, pageSize: 100 }),
        this.buddy.getActivePair(actor.id), this.buddy.getOutgoingPending(actor.id), this.buddy.listIncomingPending(actor.id),
      ]);
      if (active || outgoing || incoming.length > 0 || sidebar.total > sidebar.items.length) return hub;
      const waiting = feed.items.slice(0, 3);
      const rooms = [...sidebar.items, ...hub.recommendedZones];
      if (rooms.some((room) => room.visibility !== "PUBLIC" || room.isArchived)) return hub;
      const ids = [...new Set([hub.featured.zone.id, ...rooms.map((room) => room.id), ...waiting.map((item) => item.zone.id)])];
      const publicRooms = await this.zones.listPublicReviewZones(ids);
      if (publicRooms.length !== ids.length) return hub;
      if (publicRooms.some((room) => room.examType !== null && !Object.values(ExamType).includes(room.examType as ExamType))) return hub;
      const examType = publicRooms.some((room) => room.examType === ExamType.LGS) ? ExamType.LGS
        : publicRooms.some((room) => room.examType === ExamType.YKS) ? ExamType.YKS : null;
      const row = (item: ForumFeedItem) => ({ id: item.id, title: item.title ?? item.body,
        zone: item.zone, author: item.author.displayName, createdAt: item.createdAt, lastActivityAt: item.lastActivityAt });
      const projection = { featured: row(hub.featured), waiting: waiting.map(row),
        rooms: rooms.map((room) => ({ id: room.id, title: room.title, slug: room.slug, description: room.description, examType: room.examType, type: room.type })),
        supporters: hub.supporters.map((person) => ({ id: person.id, name: person.displayName, avatarUrl: person.avatarUrl })),
        tags: hub.trendingTags.slice(0, 4).map((tag) => ({ id: tag.id, slug: tag.slug })),
        roomVersions: publicRooms.sort((a, b) => a.id.localeCompare(b.id)).map((room) => [room.id, room.updatedAt.toISOString(), room.examType]),
      };
      const contentRevision = createHash("sha256").update(JSON.stringify(projection)).digest("hex");
      return { ...hub, adContext: { contentRevision, waitingQuestions: waiting, sidebarRooms: sidebar.items, examType } };
    } catch { return hub; } // Context failures must never interrupt discovery reading.
  }

  async resolve(actor: ThreadActor, renderedRevision?: string): Promise<{ verified: boolean; examType: ExamType | null }> {
    if (!renderedRevision || !(await this.gatesOpen())) return { verified: false, examType: null };
    try {
      const hub = await this.getHub(actor);
      const verified = Boolean(hub.adContext && hub.adContext.contentRevision === renderedRevision);
      return { verified, examType: verified ? hub.adContext!.examType : null };
    } catch { return { verified: false, examType: null }; }
  }
}
