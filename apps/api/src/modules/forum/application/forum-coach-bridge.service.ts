import { HttpStatus, Injectable } from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
import {
  type ForumCoachBridgeView,
  type ForumCoachIntent,
  ZoneType,
} from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { selectForumCoachIntent } from "../domain/forum-discovery.policy";
import { ForumDiscoveryRepository } from "../infrastructure/forum-discovery.repository";
import { ForumThreadRepository } from "../infrastructure/forum-thread.repository";
import { ForumZoneRepository } from "../infrastructure/forum-zone.repository";

/** The only community shape allowed to cross into the AI prompt builder. */
export interface ForumCoachContext {
  threadId: string;
  intent: ForumCoachIntent;
  zoneType: typeof ZoneType.CHAT | typeof ZoneType.QA;
  tagSlug: string;
  tagName: string;
}

@Injectable()
export class ForumCoachBridgeService {
  constructor(
    private readonly threads: ForumThreadRepository,
    private readonly zones: ForumZoneRepository,
    private readonly discovery: ForumDiscoveryRepository,
    private readonly config: ConfigRegistryService,
  ) {}

  async getBridge(
    viewerId: string,
    threadId: string,
    locale = I18nContext.current()?.lang ?? "tr",
  ): Promise<ForumCoachBridgeView> {
    const bridge = await this.tryGetBridge(viewerId, threadId, locale);
    if (!bridge) {
      throw new DomainError(ErrorCode.FORUM_THREAD_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return bridge;
  }

  async tryGetBridge(
    viewerId: string,
    threadId: string,
    locale = I18nContext.current()?.lang ?? "tr",
  ): Promise<ForumCoachBridgeView | null> {
    const [forumEnabled, bridgeEnabled] = await Promise.all([
      this.config.get(FeatureFlag.FORUM_ENABLED),
      this.config.get(FeatureFlag.FORUM_COACH_BRIDGE_ENABLED),
    ]);
    if (!forumEnabled || !bridgeEnabled) return null;

    const thread = await this.threads.findById(threadId, viewerId);
    // Keep the application-policy belt explicit: local/e2e DB roles may bypass RLS.
    if (!thread || thread.deletedAt) return null;
    const [zone, tagMap] = await Promise.all([
      this.zones.findById(thread.zoneId, viewerId),
      this.discovery.tagsByThread([threadId], locale),
    ]);
    if (
      !zone ||
      zone.isArchived ||
      (zone.type !== ZoneType.CHAT && zone.type !== ZoneType.QA)
    ) {
      return null;
    }

    const tags = tagMap.get(threadId) ?? [];
    const selected = selectForumCoachIntent(tags);
    if (!selected) return null;
    const selectedTag = tags.find(
      (tag) => tag.slug === selected.slug && tag.coachIntent === selected.intent,
    );
    if (!selectedTag) return null;
    const lang = locale.toLowerCase().startsWith("en") ? "en" : "tr";

    return {
      threadId,
      intent: selected.intent,
      tag: {
        slug: selectedTag.slug,
        name: lang === "en" ? selectedTag.nameEn : selectedTag.nameTr,
      },
      zone: {
        slug: zone.slug,
        title: zone.title,
        type: zone.type,
      },
      threadTitle: thread.title,
    };
  }

  async resolveForCoach(
    viewerId: string,
    threadId: string,
    locale = I18nContext.current()?.lang ?? "tr",
  ): Promise<ForumCoachContext> {
    const bridge = await this.getBridge(viewerId, threadId, locale);
    return {
      threadId: bridge.threadId,
      intent: bridge.intent,
      zoneType: bridge.zone.type as ForumCoachContext["zoneType"],
      tagSlug: bridge.tag.slug,
      tagName: bridge.tag.name,
    };
  }
}
