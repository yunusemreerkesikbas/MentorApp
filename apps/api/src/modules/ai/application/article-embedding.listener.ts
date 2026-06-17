import { Inject, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../../../shared/ports/job-queue.port";
import { ArticlePublished, ContentEventTopic } from "../../content/domain/content.events";
import { AI_EMBED_JOB } from "../domain/ai.constants";

/**
 * Content → AI RAG seam: when an article is published, enqueue an embed job (async/retryable — the
 * embed hits an external API; never block the publish path). Consumes the existing ArticlePublished
 * event (no change to content).
 */
@Injectable()
export class ArticleEmbeddingListener {
  constructor(@Inject(JOB_QUEUE_PORT) private readonly queue: JobQueuePort) {}

  @OnEvent(ContentEventTopic.ARTICLE_PUBLISHED)
  async onPublished(event: ArticlePublished): Promise<void> {
    await this.queue.enqueue(AI_EMBED_JOB, { articleId: event.articleId });
  }
}
