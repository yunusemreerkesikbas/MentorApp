import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  ForumEventTopic,
  type AnswerAccepted,
} from "../../forum/domain/forum.events";
import { MistakeNotebookService } from "./mistake-notebook.service";

/**
 * Bridges forum → notebook: when the asker accepts an answer, the notebook cards linked to that
 * thread learn there is a verified solution waiting.
 *
 * Consumes the forum event only — no runtime dependency on the forum module, same pattern as
 * economy's `ForumEventsListener`. This is the whole coupling between the two contexts: forum does
 * not know the notebook exists, and the notebook never reads a forum table.
 */
@Injectable()
export class NotebookForumListener {
  private readonly logger = new Logger(NotebookForumListener.name);

  constructor(private readonly notebook: MistakeNotebookService) {}

  @OnEvent(ForumEventTopic.ANSWER_ACCEPTED)
  async onAnswerAccepted(event: AnswerAccepted): Promise<void> {
    // Swallow + log: this runs inside the accept's awaited emitAsync, so throwing here would 500 an
    // accept that already committed. Marking a card is best-effort and idempotent (same timestamp
    // written twice is the same row), so a lost one costs a badge, not data.
    try {
      const marked = await this.notebook.markCommunityAnswered(
        event.threadId,
        new Date(),
      );
      if (marked > 0) {
        this.logger.log(
          `Notebook: ${marked} card(s) linked to thread ${event.threadId} now have an accepted answer.`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Notebook: could not mark thread ${event.threadId} as answered`,
        err as Error,
      );
    }
  }
}
