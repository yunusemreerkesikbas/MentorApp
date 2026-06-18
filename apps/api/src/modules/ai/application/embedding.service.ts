import { Inject, Injectable } from "@nestjs/common";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../../../shared/ports/job-queue.port";
import { ContentService } from "../../content/application/content.service";
import { AI_EMBED_JOB } from "../domain/ai.constants";

/** Backfill orchestration (W3 RAG): enqueue embed jobs for published articles still missing one. */
@Injectable()
export class EmbeddingService {
  constructor(
    @Inject(JOB_QUEUE_PORT) private readonly queue: JobQueuePort,
    private readonly content: ContentService,
  ) {}

  async enqueueBackfill(): Promise<{ enqueued: number }> {
    const ids = await this.content.listPublishedNeedingEmbedding();
    for (const articleId of ids) {
      await this.queue.enqueue(AI_EMBED_JOB, { articleId });
    }
    return { enqueued: ids.length };
  }
}
