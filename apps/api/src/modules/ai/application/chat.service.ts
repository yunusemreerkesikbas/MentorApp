import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ContentService } from "../../content/application/content.service";
import { LLM_PORT, type LlmPort } from "../domain/llm.port";
import { buildSystemPrompt, estimateCostMicros, RAG_MAX_DISTANCE, RAG_TOP_K } from "../domain/ai.constants";
import { ContextBuilder } from "./context-builder.service";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";

export interface CoachReplyResult {
  reply: string;
  model: string;
  sources: { title: string; slug: string; url: string }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * AI coach chat (W3 slice 1, single-turn). Premium is enforced by the controller's PremiumGuard.
 * Here: global kill-switch (`ai.enabled`) → daily rate-limit (§7) → PII-free grounded prompt
 * (§4 #1/#6) → LLM → usage meter. No conversation history; no official-info generation.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly context: ContextBuilder,
    private readonly usage: AiUsageRepository,
    private readonly content: ContentService,
    private readonly config: ConfigRegistryService,
  ) {}

  async reply(userId: string, message: string): Promise<CoachReplyResult> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }

    const dailyLimit = await this.config.get("ai.chat.daily_limit");
    const usedToday = await this.usage.countSince(userId, new Date(Date.now() - DAY_MS));
    if (usedToday >= dailyLimit) {
      throw new DomainError(ErrorCode.AI_RATE_LIMITED, HttpStatus.TOO_MANY_REQUESTS);
    }

    const ctx = await this.context.build(userId);

    // RAG (§1): retrieve verified articles in the user's exam family to ground the answer. Embed
    // failure must not break the chat — fall back to ungrounded (the prompt then forbids fabrication).
    let retrieved: { title: string; slug: string; sourceUrl: string; snippet: string }[] = [];
    if (ctx.examType) {
      try {
        const vector = await this.llm.embed(message);
        retrieved = await this.content.searchSimilarArticles(
          ctx.examType,
          vector,
          RAG_TOP_K,
          RAG_MAX_DISTANCE,
        );
      } catch (err) {
        this.logger.warn(`RAG retrieval skipped: ${String(err)}`);
      }
    }

    const result = await this.llm.complete({
      system: buildSystemPrompt(ctx, retrieved),
      user: message,
    });

    await this.usage.append({
      userId,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costMicros: estimateCostMicros(result.model, result.promptTokens, result.completionTokens),
    });

    return {
      reply: result.text,
      model: result.model,
      sources: retrieved.map((s) => ({ title: s.title, slug: s.slug, url: s.sourceUrl })),
    };
  }
}
