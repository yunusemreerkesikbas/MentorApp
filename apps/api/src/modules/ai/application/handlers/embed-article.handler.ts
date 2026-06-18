import { Inject, Injectable, Logger } from "@nestjs/common";
import { z } from "zod";
import { ContentService } from "../../../content/application/content.service";
import { LLM_PORT, type LlmPort } from "../../domain/llm.port";

const payloadSchema = z.object({ articleId: z.string().uuid() });

/**
 * EMBED_ARTICLE job handler (W3 RAG): embed a published article's text and store the vector via the
 * content service (content owns the column). Idempotent — a missing/unpublished article is a no-op;
 * embed failures throw so the job retries.
 */
@Injectable()
export class EmbedArticleHandler {
  private readonly logger = new Logger(EmbedArticleHandler.name);

  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly content: ContentService,
  ) {}

  async handle(payload: unknown): Promise<void> {
    const { articleId } = payloadSchema.parse(payload);
    const article = await this.content.getArticleForEmbedding(articleId);
    if (!article) {
      this.logger.warn(`embed skipped — article ${articleId} not found`);
      return;
    }
    const vector = await this.llm.embed(`${article.title}\n${article.body}`);
    await this.content.setArticleEmbedding(articleId, vector);
  }
}
