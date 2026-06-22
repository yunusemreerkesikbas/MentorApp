import { HttpStatus, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { type ThreadFeed, type ThreadView, ZoneRole, ZoneType } from "@mentor/types";
import type { CreateThread, FeedQuery } from "@mentor/validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import {
  canDeleteThread,
  canPinThread,
  canPostInZone,
  type ForumActor,
} from "../domain/forum.policy";
import { ForumEventTopic } from "../domain/forum.events";
import { ForumZoneRepository } from "../infrastructure/forum-zone.repository";
import { ForumThreadRepository, type ThreadRow } from "../infrastructure/forum-thread.repository";
import { threadRowToView } from "./forum.mappers";

/** Minimal authenticated principal the controller passes in (id + platform roles). */
export interface ThreadActor {
  id: string;
  roles: string[];
}

/**
 * Forum feed (Slice 2): post/list/pin/delete threads + reactions for CHAT/ANNOUNCEMENT zones.
 * Gated by `forum.enabled`; authz via forum.policy. No XP/economy yet (Slice 3). No coin (§4 #3).
 */
@Injectable()
export class ForumThreadService {
  constructor(
    private readonly threads: ForumThreadRepository,
    private readonly zones: ForumZoneRepository,
    private readonly config: ConfigRegistryService,
    private readonly events: EventEmitter2,
  ) {}

  private async assertEnabled(): Promise<void> {
    if (!(await this.config.get("forum.enabled"))) {
      throw new DomainError(ErrorCode.FORUM_DISABLED, HttpStatus.NOT_FOUND);
    }
  }

  /** Build the actor's two-plane authz view for a zone (their scoped role + status). */
  private async actorFor(
    zoneId: string,
    actor: ThreadActor,
  ): Promise<{ forumActor: ForumActor; memberStatus: string | null }> {
    const membership = await this.zones.findMembership(zoneId, actor.id);
    return {
      forumActor: {
        userId: actor.id,
        platformRoles: actor.roles,
        zoneRole: (membership?.role as ZoneRole | undefined) ?? null,
      },
      memberStatus: membership?.status ?? null,
    };
  }

  async postThread(actor: ThreadActor, zoneId: string, dto: CreateThread): Promise<ThreadView> {
    await this.assertEnabled();
    const zone = await this.zones.findById(zoneId, actor.id);
    if (!zone) throw new DomainError(ErrorCode.FORUM_ZONE_NOT_FOUND, HttpStatus.NOT_FOUND);
    const { forumActor, memberStatus } = await this.actorFor(zoneId, actor);
    if (!canPostInZone(forumActor, zone.type, memberStatus)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    // A QA question needs a title; chat/announcement items must not carry one.
    if (zone.type === ZoneType.QA && !dto.title?.trim()) {
      throw new DomainError(ErrorCode.FORUM_QUESTION_TITLE_REQUIRED, HttpStatus.BAD_REQUEST);
    }
    const title = zone.type === ZoneType.QA ? dto.title : null;
    const row = await this.threads.createThread({ zoneId, authorId: actor.id, body: dto.body, title });
    this.events.emit(ForumEventTopic.THREAD_POSTED, {
      zoneId,
      threadId: row.id,
      authorId: actor.id,
    });
    return threadRowToView(row, {}, []);
  }

  async listFeed(viewerId: string, zoneId: string, q: FeedQuery): Promise<ThreadFeed> {
    await this.assertEnabled();
    const zone = await this.zones.findById(zoneId, viewerId);
    if (!zone) throw new DomainError(ErrorCode.FORUM_ZONE_NOT_FOUND, HttpStatus.NOT_FOUND);
    const rows = await this.threads.listFeed(viewerId, zoneId, { limit: q.limit, before: q.before });
    const ids = rows.map((r) => r.id);
    // Two batched lookups (no N+1).
    const [counts, mine] = await Promise.all([
      this.threads.reactionCountsByThread(ids),
      this.threads.myReactionsByThread(ids, viewerId),
    ]);
    const items = rows.map((r) => threadRowToView(r, counts.get(r.id) ?? {}, mine.get(r.id) ?? []));
    // ponytail: heuristic cursor — a full page may have more; worst case one empty trailing fetch.
    const last = items.at(-1);
    const nextCursor = rows.length === q.limit && last ? last.createdAt : null;
    return { items, nextCursor };
  }

  async pin(actor: ThreadActor, threadId: string, pinned: boolean): Promise<void> {
    await this.assertEnabled();
    const thread = await this.requireThread(threadId, actor.id);
    const { forumActor } = await this.actorFor(thread.zoneId, actor);
    if (!canPinThread(forumActor)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    await this.threads.setPinned(threadId, pinned);
  }

  async remove(actor: ThreadActor, threadId: string): Promise<void> {
    await this.assertEnabled();
    const thread = await this.requireThread(threadId, actor.id);
    const { forumActor } = await this.actorFor(thread.zoneId, actor);
    if (!canDeleteThread(forumActor, thread.authorId)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    await this.threads.softDelete(threadId, actor.id);
  }

  async react(userId: string, threadId: string, emoji: string): Promise<void> {
    await this.assertEnabled();
    await this.requireThread(threadId, userId); // visibility belt
    await this.threads.addReaction(threadId, userId, emoji);
  }

  async unreact(userId: string, threadId: string, emoji: string): Promise<void> {
    await this.assertEnabled();
    await this.requireThread(threadId, userId);
    await this.threads.removeReaction(threadId, userId, emoji);
  }

  private async requireThread(threadId: string, viewerId: string): Promise<ThreadRow> {
    const thread = await this.threads.findById(threadId, viewerId);
    if (!thread) throw new DomainError(ErrorCode.FORUM_THREAD_NOT_FOUND, HttpStatus.NOT_FOUND);
    // Zone-visibility belt: the parent zone must be visible to the viewer (RLS-gated to PUBLIC,
    // non-archived). pin/remove/react fetch the thread directly, so without this the visibility
    // guard that postThread/listFeed get for free would be bypassed once PRIVATE zones land.
    const zone = await this.zones.findById(thread.zoneId, viewerId);
    if (!zone) throw new DomainError(ErrorCode.FORUM_THREAD_NOT_FOUND, HttpStatus.NOT_FOUND);
    return thread;
  }
}
