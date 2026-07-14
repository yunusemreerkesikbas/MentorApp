import { randomUUID } from "node:crypto";
import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import {
  Currency,
  type CoachChatReplyDto,
  type CoachChatStreamEvent,
  type MockExamDto,
} from "@mentor/types";
import type { RequestUser } from "../../../common/auth/current-user";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ContentService } from "../../content/application/content.service";
import { MockExamService } from "../../coaching/application/mock-exam.service";
import { EconomyService } from "../../economy/application/economy.service";
import { EconomyLedger } from "../../economy/domain/economy.constants";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { LLM_PORT, type LlmHistoryMessage, type LlmPort } from "../domain/llm.port";
import {
  AI_MEMORY_JOB,
  AiUsageFeature,
  buildConversationTitle,
  buildSystemPrompt,
  CHAT_HISTORY_MAX_MESSAGES,
  estimateCostMicros,
  MEMORY_REFRESH_EVERY_N_MESSAGES,
  RAG_MAX_DISTANCE,
  RAG_TOP_K,
} from "../domain/ai.constants";
import { createTaskMarkerFilter, extractSuggestedTask } from "../domain/suggested-task";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../../../shared/ports/job-queue.port";
import { ContextBuilder } from "./context-builder.service";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import { CoachMessageRepository } from "../infrastructure/coach-message.repository";
import { CoachMemoryRepository } from "../infrastructure/coach-memory.repository";
import { CoachConversationRepository } from "../infrastructure/coach-conversation.repository";
import { AiBudgetGuard } from "./ai-budget.guard";

export type CoachReplyResult = CoachChatReplyDto;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * AI coach chat (W3): premium (flat + rate-limit) or free earned-coin path (spend + free daily cap).
 * PII-free grounded prompt (§4 #1/#6); multi-turn via persisted rolling history (last N messages).
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
    private readonly messages: CoachMessageRepository,
    private readonly conversations: CoachConversationRepository,
    private readonly memory: CoachMemoryRepository,
    private readonly budget: AiBudgetGuard,
    @Inject(JOB_QUEUE_PORT) private readonly queue: JobQueuePort,
    private readonly mockExams: MockExamService,
  ) {}

  /**
   * Resolve the thread this message belongs to: verify ownership of an existing one, or open a new
   * conversation titled after the message (first ~60 chars — no LLM call).
   */
  private async resolveConversation(
    userId: string,
    message: string,
    conversationId?: string,
  ): Promise<string> {
    if (conversationId) {
      if (!(await this.conversations.isOwned(userId, conversationId))) {
        throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      return conversationId;
    }
    return this.conversations.create(userId, buildConversationTitle(message));
  }

  async reply(
    user: RequestUser,
    message: string,
    clientMessageId?: string,
    conversationId?: string,
    contextMockExamId?: string,
  ): Promise<CoachReplyResult> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }
    await this.budget.assertWithinBudget();

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
      const mockExam = contextMockExamId
        ? await this.mockExams.getById(user.id, contextMockExamId)
        : undefined;
      const threadId = await this.resolveConversation(user.id, message, conversationId);
      return await this.completeChat(user.id, threadId, message, mockExam);
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

  /** Shared prompt prep: PII-free context + this thread's multi-turn history + RAG retrieval. */
  private async prepareChat(
    userId: string,
    conversationId: string,
    message: string,
    mockExam?: MockExamDto,
  ) {
    const ctx = await this.context.build(userId);

    // Multi-turn: replay the last N messages OF THIS THREAD (the user's own words + earlier coach
    // replies — no third-party PII, §4 #6). Defensive: a history failure never blocks the chat.
    const history: LlmHistoryMessage[] = await this.messages
      .lastN(userId, conversationId, CHAT_HISTORY_MAX_MESSAGES)
      .then((rows) =>
        rows.map((m) => ({
          role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
          content: m.content,
        })),
      )
      .catch((err) => {
        this.logger.warn(`Chat history load skipped: ${String(err)}`);
        return [];
      });

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

    const system = buildSystemPrompt(ctx, retrieved, mockExam);

    return {
      llmInput: { system, user: message, history },
      sources: retrieved.map((s) => ({ title: s.title, slug: s.slug, url: s.sourceUrl })),
    };
  }

  /** Post-success bookkeeping: usage meter + persist the exchange + maybe refresh memory (only on success). */
  private async recordSuccess(
    userId: string,
    conversationId: string,
    message: string,
    result: { text: string; promptTokens: number; completionTokens: number; model: string },
    sources: { title: string; slug: string; url: string }[],
    suggestedTask?: { title: string; subject: string | null },
  ): Promise<void> {
    await this.usage.append({
      userId,
      model: result.model,
      feature: AiUsageFeature.CHAT,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costMicros: estimateCostMicros(result.model, result.promptTokens, result.completionTokens),
    });

    // Best-effort: a persist failure must not swallow the reply the user already paid for.
    const persisted = await this.messages
      .appendExchange(userId, conversationId, message, {
        content: result.text,
        model: result.model,
        sources,
        suggestedTask,
      })
      .catch((err) => {
        this.logger.error(`Chat history persist failed: ${String(err)}`);
        return null;
      });

    // Memory profile: enqueue an async refresh every N messages (never blocks the chat).
    if (persisted && persisted.totalMessages % MEMORY_REFRESH_EVERY_N_MESSAGES === 0) {
      await this.queue.enqueue(AI_MEMORY_JOB, { userId }).catch((err) => {
        this.logger.warn(`Memory refresh enqueue skipped: ${String(err)}`);
      });
    }
  }

  private async completeChat(
    userId: string,
    conversationId: string,
    message: string,
    mockExam?: MockExamDto,
  ): Promise<CoachReplyResult> {
    const { llmInput, sources } = await this.prepareChat(
      userId,
      conversationId,
      message,
      mockExam,
    );
    const result = await this.llm.complete(llmInput);
    const { text: reply, task } = extractSuggestedTask(result.text);
    await this.recordSuccess(
      userId,
      conversationId,
      message,
      { ...result, text: reply },
      sources,
      task ?? undefined,
    );
    return {
      reply,
      model: result.model,
      conversationId,
      sources,
      ...(task ? { suggestedTask: task } : {}),
    };
  }

  /**
   * Streaming variant of `reply` (POST /v1/coach/chat/stream). Same gating/coin/rate-limit path;
   * yields text deltas, then one `done` with the full reply. Mid-stream LLM failure refunds the
   * coin spend (same rule as `reply`) and rethrows — the controller emits the `error` event.
   */
  async *replyStream(
    user: RequestUser,
    message: string,
    clientMessageId?: string,
    conversationId?: string,
    contextMockExamId?: string,
  ): AsyncGenerator<CoachChatStreamEvent> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }
    await this.budget.assertWithinBudget();

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
      const mockExam = contextMockExamId
        ? await this.mockExams.getById(user.id, contextMockExamId)
        : undefined;
      const threadId = await this.resolveConversation(user.id, message, conversationId);
      const { llmInput, sources } = await this.prepareChat(
        user.id,
        threadId,
        message,
        mockExam,
      );
      // The task marker must never leak into deltas — filter holds back anything marker-like.
      const markerFilter = createTaskMarkerFilter();
      let final: { text: string; promptTokens: number; completionTokens: number; model: string } | null =
        null;
      for await (const ev of this.llm.completeStream(llmInput)) {
        if (ev.delta) {
          const safe = markerFilter.push(ev.delta);
          if (safe) yield { delta: safe };
        }
        if (ev.final) final = ev.final;
      }
      if (!final) {
        throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
      }
      const held = markerFilter.flush();
      if (held) yield { delta: held };
      const { text: reply, task } = extractSuggestedTask(final.text);
      await this.recordSuccess(
        user.id,
        threadId,
        message,
        { ...final, text: reply },
        sources,
        task ?? undefined,
      );
      yield {
        done: {
          reply,
          model: final.model,
          conversationId: threadId,
          sources,
          ...(task ? { suggestedTask: task } : {}),
        },
      };
    } catch (err) {
      if (!ent.isPremium && shouldRefundOnFailure && coinCost > 0) {
        await this.refundCoinSpend(user.id, coinCost, spendRefId).catch((refundErr) => {
          this.logger.error(`Coin refund failed after stream error: ${String(refundErr)}`);
        });
      }
      throw err;
    }
  }

  /** GET /v1/coach/conversations — the user's threads, most-recently-active first. */
  async listConversations(userId: string, page: number, pageSize: number) {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }
    return this.conversations.listPaged(userId, page, pageSize);
  }

  /** GET /v1/coach/conversations/:id/messages — one thread's history (auth-only; ownership enforced). */
  async listConversationMessages(
    userId: string,
    conversationId: string,
    page: number,
    pageSize: number,
  ) {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }
    if (!(await this.conversations.isOwned(userId, conversationId))) {
      throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return this.messages.listPagedByConversation(userId, conversationId, page, pageSize);
  }

  /** DELETE /v1/coach/conversations/:id — drop one thread (messages cascade). Memory profile is kept. */
  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }
    const deleted = await this.conversations.delete(userId, conversationId);
    if (!deleted) throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
  }

  /** PATCH /v1/coach/messages/:id/feedback — 👍/👎/none on the user's own coach message. */
  async setMessageFeedback(userId: string, messageId: string, feedback: number | null): Promise<void> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }
    const ok = await this.messages.setFeedback(userId, messageId, feedback);
    if (!ok) throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
  }

  /** GET /v1/coach/memory — the coach's distilled profile of the user (null until built). */
  async getMemory(userId: string): Promise<{ summary: string; updatedAt: string } | null> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }
    const row = await this.memory.get(userId);
    return row ? { summary: row.summary, updatedAt: row.updatedAt.toISOString() } : null;
  }

  /** DELETE /v1/coach/memory — reset the profile (user-controlled, KVKK). */
  async clearMemory(userId: string): Promise<void> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }
    await this.memory.clear(userId);
  }
}
