import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UsersService } from "../../identity/application/users.service";
import { ForumEventTopic } from "../domain/forum.events";
import { extractMentions } from "../domain/mention";

/**
 * Resolves @mentions in a post/comment body and emits one `USER_MENTIONED` event per real, distinct
 * mentioned user → notifications listener turns each into an in-app notification. Fire-and-forget:
 * the caller doesn't await notification writes. Self-mentions and already-notified recipients (e.g. the
 * parent author who gets a reply notification) are excluded so nobody is double-notified.
 */
@Injectable()
export class ForumMentionService {
  private readonly logger = new Logger(ForumMentionService.name);

  constructor(
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
  ) {}

  /** Best-effort: resolution failures are logged, never thrown — a mention hiccup must not break the
   * post. Callers fire-and-forget (`void`). */
  async dispatch(
    body: string,
    actorId: string,
    link: string,
    excludeUserIds: string[] = [],
  ): Promise<void> {
    try {
      const handles = extractMentions(body);
      if (handles.length === 0) return;
      const idByHandle = await this.users.findIdsByUsernames(handles);
      const exclude = new Set([actorId, ...excludeUserIds]);
      for (const recipientId of idByHandle.values()) {
        if (exclude.has(recipientId)) continue;
        this.events.emit(ForumEventTopic.USER_MENTIONED, { recipientId, actorId, link });
      }
    } catch (err) {
      this.logger.warn(`mention dispatch failed: ${String(err)}`);
    }
  }
}
