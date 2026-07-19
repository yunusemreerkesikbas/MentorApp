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
  private notify(recipientId: string, actorId: string, title: string, body: string, linkUrl: string): Promise<void> {
    if (recipientId === actorId) return Promise.resolve();
    return this.notifications
      .createInApp(recipientId, "FORUM", title, body, linkUrl)
      .catch((err: unknown) => this.logger.warn(`forum notification failed for ${recipientId}: ${String(err)}`));
  }

  @OnEvent(ForumEventTopic.QUESTION_ANSWERED)
  async onQuestionAnswered(e: QuestionAnswered): Promise<void> {
    await this.notify(
      e.recipientId,
      e.actorId,
      "Sorunuza cevap geldi",
      "Sorduğun soruya yeni bir cevap yazıldı.",
      `/community/question/${e.threadId}`,
    );
  }

  @OnEvent(ForumEventTopic.THREAD_COMMENTED)
  async onThreadCommented(e: ThreadCommented): Promise<void> {
    await this.notify(
      e.recipientId,
      e.actorId,
      "Gönderinize yorum yapıldı",
      "Paylaşımına yeni bir yorum yapıldı.",
      `/community/message/${e.threadId}`,
    );
  }

  @OnEvent(ForumEventTopic.COMMENT_REPLIED)
  async onCommentReplied(e: CommentReplied): Promise<void> {
    await this.notify(
      e.recipientId,
      e.actorId,
      "Yorumunuza yanıt geldi",
      "Yorumuna yeni bir yanıt geldi.",
      `/community/comment/${e.parentPostId}`,
    );
  }

  @OnEvent(ForumEventTopic.ANSWER_ACCEPTED)
  async onAnswerAccepted(e: AnswerAccepted): Promise<void> {
    await this.notify(
      e.answerAuthorId,
      e.askerId,
      "Cevabınız kabul edildi 🎉",
      "Yazdığın cevap en iyi cevap olarak seçildi!",
      `/community/question/${e.threadId}`,
    );
  }

  @OnEvent(ForumEventTopic.USER_MENTIONED)
  async onUserMentioned(e: UserMentioned): Promise<void> {
    await this.notify(
      e.recipientId,
      e.actorId,
      "Sizden bahsedildi",
      "Bir gönderide sizden bahsedildi.",
      e.link,
    );
  }

  @OnEvent(ForumEventTopic.MEMBER_REQUESTED)
  async onMemberRequested(e: MemberRequested): Promise<void> {
    await Promise.all(
      e.moderatorIds.map((modId) =>
        this.notify(
          modId,
          e.requesterId,
          "Alanınıza katılım isteği",
          "Yönettiğin bir alana yeni bir katılım isteği geldi.",
          `/community/${e.slug}/management`,
        ),
      ),
    );
  }
}
