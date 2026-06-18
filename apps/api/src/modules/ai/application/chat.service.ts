import { randomUUID } from "node:crypto";
import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { Currency, type CoachChatReplyDto } from "@mentor/types";
import type { RequestUser } from "../../../common/auth/current-user";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ContentService } from "../../content/application/content.service";
import { EconomyService } from "../../economy/application/economy.service";
import { EconomyLedger } from "../../economy/domain/economy.constants";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { LLM_PORT, type LlmPort } from "../domain/llm.port";
import { buildSystemPrompt, estimateCostMicros, RAG_MAX_DISTANCE, RAG_TOP_K } from "../domain/ai.constants";
import { ContextBuilder } from "./context-builder.service";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";

export type CoachReplyResult = CoachChatReplyDto;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * AI coach chat (W3): premium (flat + rate-limit) or free earned-coin path (spend + free daily cap).
 * PII-free grounded prompt (§4 #1/#6); no conversation history yet.
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
    private readonly entitlement: EntitlementService,
    private readonly economy: EconomyService,
  ) {}

  async reply(
    user: RequestUser,
    message: string,
    clientMessageId?: string,
  ): Promise<CoachReplyResult> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }

    const ent = await this.entitlement.getEntitlement(user.id, user.roles);
    const spendRefId = clientMessageId ?? randomUUID();
    let coinCost = 0;
    let shouldRefundOnFailure = false;

    if (ent.isPremium) {
      await this.assertPremiumRateLimit(user.id);
    } else {
      ({ cost: coinCost, shouldRefundOnFailure } = await this.prepareCoinSpend(user.id, spendRefId));
    }

    try {
      return await this.completeChat(user.id, message);
    } catch (err) {
      if (!ent.isPremium && shouldRefundOnFailure && coinCost > 0) {
        await this.refundCoinSpend(user.id, coinCost, spendRefId).catch((refundErr) => {
          this.logger.error(`Coin refund failed after LLM error: ${String(refundErr)}`);
        });
      }
      throw err;
    }
  }

  private async assertPremiumRateLimit(userId: string): Promise<void> {
    const dailyLimit = await this.config.get("ai.chat.daily_limit");
    const usedToday = await this.usage.countSince(userId, new Date(Date.now() - DAY_MS));
    if (usedToday >= dailyLimit) {
      throw new DomainError(ErrorCode.AI_RATE_LIMITED, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async prepareCoinSpend(
    userId: string,
    spendRefId: string,
  ): Promise<{ cost: number; shouldRefundOnFailure: boolean }> {
    if (!(await this.config.get(FeatureFlag.ECONOMY_ENABLED))) {
      throw new DomainError(ErrorCode.PAYMENT_PREMIUM_REQUIRED, HttpStatus.FORBIDDEN);
    }

    const [chatCost, freeDailyLimit, usedToday] = await Promise.all([
      this.config.get("economy.coin.ai_chat_cost"),
      this.config.get("ai.chat.free_coin_daily_limit"),
      this.economy.coinChatSpendsSince(userId, new Date(Date.now() - DAY_MS)),
    ]);

    if (usedToday >= freeDailyLimit) {
      throw new DomainError(ErrorCode.AI_RATE_LIMITED, HttpStatus.TOO_MANY_REQUESTS);
    }

    const { alreadySpent } = await this.economy.spend(userId, chatCost, {
      reason: EconomyLedger.AI_CHAT_SPEND_REASON,
      refType: EconomyLedger.AI_CHAT_REF_TYPE,
      refId: spendRefId,
    });

    return { cost: chatCost, shouldRefundOnFailure: !alreadySpent };
  }

  private async refundCoinSpend(userId: string, amount: number, spendRefId: string): Promise<void> {
    await this.economy.grant(userId, Currency.COIN, amount, {
      reason: EconomyLedger.AI_CHAT_REFUND_REASON,
      refType: EconomyLedger.AI_CHAT_REFUND_REF_TYPE,
      refId: spendRefId,
      enforceLimits: false,
    });
  }

  private async completeChat(userId: string, message: string): Promise<CoachReplyResult> {
    const ctx = await this.context.build(userId);

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
