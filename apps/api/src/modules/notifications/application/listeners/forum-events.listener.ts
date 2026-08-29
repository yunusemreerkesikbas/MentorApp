import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  type AnswerAccepted,
  type CommentReplied,
  ForumEventTopic,
  type MemberRequested,
  type QuestionAnswered,
  type ThreadCommented,
  type UserMentioned,
} from "../../../forum/domain/forum.events";
import { NotificationCopyKey } from "../../domain/notification-copy";
import { NotificationsService } from "../notifications.service";

/**
 * Consumes forum domain events → in-app notifications (generic, no actor name). Best-effort: a failed
 * notification never breaks the emitter. Recipients are resolved in the forum domain and carried on
 * the event payload, so this listener holds no forum dependency (only the event contracts). Self-acts
 * (replying to your own post, answering your own question, accepting your own answer) are skipped.
 */
@Injectable()
export class ForumEventsListener {
  private readonly logger = new Logger(ForumEventsListener.name);

  constructor(private readonly notifications: NotificationsService) {}

  /** Create an in-app notification unless the actor is the recipient. Best-effort: a failed write is
   * logged (not thrown) so it never breaks the emitting request. */
  private notify(
    recipientId: string,
    actorId: string,
    templateKey: NotificationCopyKey,
    linkUrl: string,
  ): Promise<void> {
    if (recipientId === actorId) return Promise.resolve();
    return this.notifications
      .createFromTemplate(recipientId, "FORUM", templateKey, linkUrl)
      .then(() => undefined)
      .catch((err: unknown) => this.logger.warn(`forum notification failed for ${recipientId}: ${String(err)}`));
  }

  @OnEvent(ForumEventTopic.QUESTION_ANSWERED)
  async onQuestionAnswered(e: QuestionAnswered): Promise<void> {
    await this.notify(e.recipientId, e.actorId, NotificationCopyKey.QUESTION_ANSWERED, `/community/question/${e.threadId}`);
  }

  @OnEvent(ForumEventTopic.THREAD_COMMENTED)
  async onThreadCommented(e: ThreadCommented): Promise<void> {
    await this.notify(e.recipientId, e.actorId, NotificationCopyKey.THREAD_COMMENTED, `/community/message/${e.threadId}`);
  }

  @OnEvent(ForumEventTopic.COMMENT_REPLIED)
  async onCommentReplied(e: CommentReplied): Promise<void> {
    await this.notify(e.recipientId, e.actorId, NotificationCopyKey.COMMENT_REPLIED, `/community/comment/${e.parentPostId}`);
  }

  @OnEvent(ForumEventTopic.ANSWER_ACCEPTED)
  async onAnswerAccepted(e: AnswerAccepted): Promise<void> {
    await this.notify(e.answerAuthorId, e.askerId, NotificationCopyKey.ANSWER_ACCEPTED, `/community/question/${e.threadId}`);
  }

  @OnEvent(ForumEventTopic.USER_MENTIONED)
  async onUserMentioned(e: UserMentioned): Promise<void> {
    await this.notify(e.recipientId, e.actorId, NotificationCopyKey.USER_MENTIONED, e.link);
  }

  @OnEvent(ForumEventTopic.MEMBER_REQUESTED)
  async onMemberRequested(e: MemberRequested): Promise<void> {
    await Promise.all(
      e.moderatorIds.map((modId) =>
        this.notify(modId, e.requesterId, NotificationCopyKey.MEMBER_REQUESTED, `/community/${e.slug}/management`),
      ),
    );
  }
}
