import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { LLM_PORT, type LlmPort } from "../domain/llm.port";
import { buildSystemPrompt, estimateCostMicros } from "../domain/ai.constants";
import { ContextBuilder } from "./context-builder.service";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * AI coach chat (W3 slice 1, single-turn). Premium is enforced by the controller's PremiumGuard.
 * Here: global kill-switch (`ai.enabled`) → daily rate-limit (§7) → PII-free grounded prompt
 * (§4 #1/#6) → LLM → usage meter. No conversation history; no official-info generation.
 */
@Injectable()
export class ChatService {
  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly context: ContextBuilder,
    private readonly usage: AiUsageRepository,
    private readonly config: ConfigRegistryService,
  ) {}

  async reply(userId: string, message: string): Promise<{ reply: string; model: string }> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }

    const dailyLimit = await this.config.get("ai.chat.daily_limit");
    const usedToday = await this.usage.countSince(userId, new Date(Date.now() - DAY_MS));
    if (usedToday >= dailyLimit) {
      throw new DomainError(ErrorCode.AI_RATE_LIMITED, HttpStatus.TOO_MANY_REQUESTS);
    }

    const ctx = await this.context.build(userId);
    const result = await this.llm.complete({ system: buildSystemPrompt(ctx), user: message });

    await this.usage.append({
      userId,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costMicros: estimateCostMicros(result.model, result.promptTokens, result.completionTokens),
    });

    return { reply: result.text, model: result.model };
  }
}
