import { randomUUID } from "node:crypto";
import { HttpStatus, Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { I18nContext, I18nService } from "nestjs-i18n";
import {
  Currency,
  type CoachChatReplyDto,
  type CoachChatStreamEvent,
  type MockExamDto,
  type CountdownDto,
  type CoachConversationOriginDto,
} from "@mentor/types";
import type { RequestUser } from "../../../common/auth/current-user";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ContentService } from "../../content/application/content.service";
import { ExamEventType } from "../../content/domain/content.constants";
import { MockExamService } from "../../coaching/application/mock-exam.service";
import { EconomyService } from "../../economy/application/economy.service";
import { EconomyLedger } from "../../economy/domain/economy.constants";
import { EntitlementService } from "../../payments/application/entitlement.service";
import {
  LLM_PORT,
  type LlmHistoryMessage,
  type LlmPort,
} from "../domain/llm.port";
import {
  AiUsageFeature,
  buildConversationTitle,
  buildSystemPrompt,
  CHAT_HISTORY_MAX_MESSAGES,
  estimateCostMicros,
  RAG_MAX_DISTANCE,
  RAG_TOP_K,
} from "../domain/ai.constants";
import {
  createTaskMarkerFilter,
  extractReplyMarkers,
} from "../domain/suggested-task";
import { classifyOfficialIntent } from "../domain/official-intent";
import { promptLocale } from "../domain/prompt-locale";
import { ContextBuilder } from "./context-builder.service";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import {
  CoachMessageRepository,
  type CoachConversationTarget,
} from "../infrastructure/coach-message.repository";
import { CoachMemoryRepository } from "../infrastructure/coach-memory.repository";
import { CoachConversationRepository } from "../infrastructure/coach-conversation.repository";
import { AiBudgetGuard } from "./ai-budget.guard";
import {
  ForumCoachBridgeService,
  type ForumCoachContext,
} from "../../forum/application/forum-coach-bridge.service";

export type CoachReplyResult = CoachChatReplyDto;
type OfficialContent = Omit<CoachReplyResult, "conversationId">;

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
    private readonly mockExams: MockExamService,
    private readonly i18n: I18nService,
    @Optional() private readonly forumCoachBridge?: ForumCoachBridgeService,
  ) {}

  private async resolveCommunityContext(
    userId: string,
    threadId?: string,
  ): Promise<ForumCoachContext | undefined> {
    if (!threadId) return undefined;
    if (!this.forumCoachBridge) {
      throw new DomainError(ErrorCode.FORUM_THREAD_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return this.forumCoachBridge.resolveForCoach(
      userId,
      threadId,
      I18nContext.current()?.lang ?? "tr",
    );
  }

  /** Validate an existing thread, or describe the new thread to create after a successful reply. */
  private async resolveConversationTarget(
    userId: string,
    message: string,
    conversationId?: string,
    community?: ForumCoachContext,
  ): Promise<CoachConversationTarget> {
    if (!conversationId) {
      const origin: CoachConversationOriginDto | undefined = community
        ? {
            type: "COMMUNITY_THREAD",
            refId: community.threadId,
            meta: { intent: community.intent, tagSlug: community.tagSlug },
          }
        : undefined;
      return {
        kind: "new",
        title: buildConversationTitle(message),
        ...(origin ? { origin } : {}),
      };
    }
    if (!(await this.conversations.isOwned(userId, conversationId))) {
      throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return { kind: "existing", conversationId };
  }

  private async resolveOfficialContent(
    userId: string,
    message: string,
    contextArticleSlug?: string,
  ): Promise<OfficialContent | null> {
    const intent = classifyOfficialIntent(message);
    if (!intent) return null;

    const ctx = await this.context.build(userId);
    const sources: CoachReplyResult["sources"] = [];
    let officialCountdown: CountdownDto | undefined;

    try {
      if (intent === "EXAM_DATE" && ctx.examType) {
        const calendar = await this.content.getExamCalendarByFamily(
          ctx.examType,
        );
        const event = calendar?.events.find(
          (item) => item.type === ExamEventType.EXAM_DATE,
        );
        if (
          calendar &&
          event &&
          calendar.daysRemaining !== null &&
          calendar.examDateLabel
        ) {
          officialCountdown = {
            examType: calendar.exam.family,
            examName: calendar.exam.name,
            daysRemaining: calendar.daysRemaining,
            examDateLabel: calendar.examDateLabel,
            source: event.source,
            sourceUrl: event.sourceUrl,
          };
        }
      } else if (ctx.examType) {
        let retrieved: {
          title: string;
          slug: string;
          sourceUrl: string;
          snippet: string;
        }[] = [];
        if (contextArticleSlug) {
          const exact = await this.content.getInfoArticleSource(
            contextArticleSlug,
            ctx.examType,
          );
          if (exact) retrieved = [exact];
        }
        if (retrieved.length === 0) {
          const vector = await this.llm.embed(`${ctx.examType} ${intent}`);
          retrieved = await this.content.searchSimilarArticles(
            ctx.examType,
            vector,
            RAG_TOP_K,
            RAG_MAX_DISTANCE,
          );
        }
        sources.push(
          ...retrieved.map((item) => ({
            title: item.title,
            slug: item.slug,
            url: item.sourceUrl,
          })),
        );
      }
    } catch (err) {
      this.logger.warn(`Official content lookup skipped: ${String(err)}`);
    }

    const hasVerifiedContent =
      officialCountdown !== undefined || sources.length > 0;
    return {
      reply: this.i18n.translate(
        `coaching.official.${hasVerifiedContent ? intent : "UNAVAILABLE"}`,
        { lang: I18nContext.current()?.lang },
      ) as unknown as string,
      model: "verified-content",
      sources,
      ...(officialCountdown ? { officialCountdown } : {}),
    };
  }

  private async completeOfficialExchange(
    userId: string,
    message: string,
    conversationId?: string,
    contextArticleSlug?: string,
    community?: ForumCoachContext,
  ): Promise<CoachReplyResult | null> {
    const official = await this.resolveOfficialContent(
      userId,
      message,
      contextArticleSlug,
    );
    if (!official) return null;

    const target = await this.resolveConversationTarget(
      userId,
      message,
      conversationId,
      community,
    );
    const threadId = await this.messages.persistExchange(
      userId,
      target,
      message,
      {
        content: official.reply,
        model: official.model,
        sources: official.sources,
        ...(official.officialCountdown
          ? { officialCountdown: official.officialCountdown }
          : {}),
      },
    );
    return { ...official, conversationId: threadId };
  }

  async reply(
    user: RequestUser,
    message: string,
    clientMessageId?: string,
    conversationId?: string,
    contextMockExamId?: string,
    contextArticleSlug?: string,
    contextCommunityThreadId?: string,
  ): Promise<CoachReplyResult> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }
    const community = await this.resolveCommunityContext(
      user.id,
      contextCommunityThreadId,
    );
    const official = await this.completeOfficialExchange(
      user.id,
      message,
      conversationId,
      contextArticleSlug,
      community,
    );
    if (official) return official;
    await this.budget.assertWithinBudget();

    const ent = await this.entitlement.getEntitlement(user.id, user.roles);
    const spendRefId = clientMessageId ?? randomUUID();
    let coinCost = 0;
    let shouldRefundOnFailure = false;

    if (ent.isPremium) {
      await this.assertPremiumRateLimit(user.id);
    } else {
      ({ cost: coinCost, shouldRefundOnFailure } = await this.prepareCoinSpend(
        user.id,
        spendRefId,
      ));
    }

    try {
      const mockExam = contextMockExamId
        ? await this.mockExams.getById(user.id, contextMockExamId)
        : undefined;
      const target = await this.resolveConversationTarget(
        user.id,
        message,
        conversationId,
        community,
      );
      return await this.completeChat(
        user.id,
        target,
        message,
        mockExam,
        contextArticleSlug,
        community,
      );
    } catch (err) {
      if (!ent.isPremium && shouldRefundOnFailure && coinCost > 0) {
        await this.refundCoinSpend(user.id, coinCost, spendRefId).catch(
          (refundErr) => {
            this.logger.error(
              `Coin refund failed after LLM error: ${String(refundErr)}`,
            );
          },
        );
      }
      throw err;
    }
  }

  private async assertPremiumRateLimit(userId: string): Promise<void> {
    const dailyLimit = await this.config.get("ai.chat.daily_limit");
    // CHAT only — greeting/plan-draft/mood have their own caps and must not eat the chat quota.
    const usedToday = await this.usage.countFeatureSince(
      userId,
      AiUsageFeature.CHAT,
      new Date(Date.now() - DAY_MS),
    );
    if (usedToday >= dailyLimit) {
      throw new DomainError(
        ErrorCode.AI_RATE_LIMITED,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async prepareCoinSpend(
    userId: string,
    spendRefId: string,
  ): Promise<{ cost: number; shouldRefundOnFailure: boolean }> {
    if (!(await this.config.get(FeatureFlag.ECONOMY_ENABLED))) {
      throw new DomainError(
        ErrorCode.PAYMENT_PREMIUM_REQUIRED,
        HttpStatus.FORBIDDEN,
      );
    }

    const [chatCost, freeDailyLimit, usedToday] = await Promise.all([
      this.config.get("economy.coin.ai_chat_cost"),
      this.config.get("ai.chat.free_coin_daily_limit"),
      this.economy.coinChatSpendsSince(userId, new Date(Date.now() - DAY_MS)),
    ]);

    if (usedToday >= freeDailyLimit) {
      throw new DomainError(
        ErrorCode.AI_RATE_LIMITED,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const { alreadySpent } = await this.economy.spend(userId, chatCost, {
      reason: EconomyLedger.AI_CHAT_SPEND_REASON,
      refType: EconomyLedger.AI_CHAT_REF_TYPE,
      refId: spendRefId,
    });

    return { cost: chatCost, shouldRefundOnFailure: !alreadySpent };
  }

  private async refundCoinSpend(
    userId: string,
    amount: number,
    spendRefId: string,
  ): Promise<void> {
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
    conversationId: string | undefined,
    message: string,
    mockExam?: MockExamDto,
    opts?: { excludeTailExchange?: boolean; contextArticleSlug?: string },
    community?: ForumCoachContext,
  ) {
    const ctx = await this.context.build(userId);

    // Multi-turn: replay the last N messages OF THIS THREAD (the user's own words + earlier coach
    // replies — no third-party PII, §4 #6). Defensive: a history failure never blocks the chat.
    // Regenerate excludes the tail USER+COACH pair — the model must not anchor on the reply being
    // replaced, and the user message is re-sent as the live prompt.
    const history: LlmHistoryMessage[] = conversationId
      ? await this.messages
          .lastN(userId, conversationId, CHAT_HISTORY_MAX_MESSAGES)
          .then((rows) =>
            opts?.excludeTailExchange ? rows.slice(0, -2) : rows,
          )
          .then((rows) =>
            rows.map((m) => ({
              role:
                m.role === "USER"
                  ? ("user" as const)
                  : ("assistant" as const),
              content: m.content,
            })),
          )
          .catch((err) => {
            this.logger.warn("Chat history load skipped: " + String(err));
            return [];
          })
      : [];
    let retrieved: {
      title: string;
      slug: string;
      sourceUrl: string;
      snippet: string;
    }[] = [];
    if (ctx.examType) {
      try {
        if (opts?.contextArticleSlug) {
          const exact = await this.content.getInfoArticleSource(
            opts.contextArticleSlug,
            ctx.examType,
          );
          if (exact) retrieved = [exact];
        }
      } catch (err) {
        this.logger.warn(`RAG retrieval skipped: ${String(err)}`);
      }
    }

    const system = buildSystemPrompt(
      ctx,
      retrieved,
      mockExam,
      promptLocale(I18nContext.current()?.lang),
      community,
    );

    return {
      llmInput: { system, user: message, history },
      sources: retrieved.map((s) => ({
        title: s.title,
        slug: s.slug,
        url: s.sourceUrl,
      })),
    };
  }

  /** Record actual provider usage, then require the complete exchange to persist. */
  private async recordSuccess(
    userId: string,
    target: CoachConversationTarget,
    message: string,
    result: {
      text: string;
      promptTokens: number;
      completionTokens: number;
      model: string;
    },
    sources: { title: string; slug: string; url: string }[],
    suggestedTask?: { title: string; subject: string | null },
  ): Promise<string> {
    await this.usage.append({
      userId,
      model: result.model,
      feature: AiUsageFeature.CHAT,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costMicros: estimateCostMicros(
        result.model,
        result.promptTokens,
        result.completionTokens,
      ),
    });

    return this.messages.persistExchange(userId, target, message, {
      content: result.text,
      model: result.model,
      sources,
      suggestedTask,
    });
  }
  private async completeChat(
    userId: string,
    target: CoachConversationTarget,
    message: string,
    mockExam?: MockExamDto,
    contextArticleSlug?: string,
    community?: ForumCoachContext,
  ): Promise<CoachReplyResult> {
    const { llmInput, sources } = await this.prepareChat(
      userId,
      target.kind === "existing" ? target.conversationId : undefined,
      message,
      mockExam,
      { contextArticleSlug },
      community,
    );
    const result = await this.llm.complete(llmInput);
    // Order-agnostic: models sometimes reverse the FOLLOWUP/TASK order — never leak a marker.
    const { text: reply, task, followUps } = extractReplyMarkers(result.text);
    const conversationId = await this.recordSuccess(
      userId,
      target,
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
      ...(followUps.length > 0 ? { followUps } : {}),
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
    contextArticleSlug?: string,
    contextCommunityThreadId?: string,
  ): AsyncGenerator<CoachChatStreamEvent> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }
    const community = await this.resolveCommunityContext(
      user.id,
      contextCommunityThreadId,
    );
    const official = await this.completeOfficialExchange(
      user.id,
      message,
      conversationId,
      contextArticleSlug,
      community,
    );
    if (official) {
      yield { done: official };
      return;
    }

    const ent = await this.entitlement.getEntitlement(user.id, user.roles);
    await this.budget.assertWithinBudget();
    const spendRefId = clientMessageId ?? randomUUID();
    let coinCost = 0;
    let shouldRefundOnFailure = false;

    if (ent.isPremium) {
      await this.assertPremiumRateLimit(user.id);
    } else {
      ({ cost: coinCost, shouldRefundOnFailure } = await this.prepareCoinSpend(
        user.id,
        spendRefId,
      ));
    }

    try {
      const mockExam = contextMockExamId
        ? await this.mockExams.getById(user.id, contextMockExamId)
        : undefined;
      const target = await this.resolveConversationTarget(
        user.id,
        message,
        conversationId,
        community,
      );
      const { llmInput, sources } = await this.prepareChat(
        user.id,
        target.kind === "existing" ? target.conversationId : undefined,
        message,
        mockExam,
        { contextArticleSlug },
        community,
      );
      const final = yield* this.streamLlm(llmInput);
      const { text: reply, task, followUps } = extractReplyMarkers(final.text);
      const threadId = await this.recordSuccess(
        user.id,
        target,
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
          ...(followUps.length > 0 ? { followUps } : {}),
        },
      };
    } catch (err) {
      if (!ent.isPremium && shouldRefundOnFailure && coinCost > 0) {
        await this.refundCoinSpend(user.id, coinCost, spendRefId).catch(
          (refundErr) => {
            this.logger.error(
              `Coin refund failed after stream error: ${String(refundErr)}`,
            );
          },
        );
      }
      throw err;
    }
  }

  /**
   * Regenerate the LAST coach reply of a thread (POST /v1/coach/conversations/:id/regenerate/stream).
   * Same gating/spend as a normal message — every regenerate is a fresh spend (no idempotency key).
   * The old COACH row is overwritten IN PLACE only after a successful generation, so a mid-stream
   * failure leaves history untouched (and refunds the coin).
   */
  async *regenerateStream(
    user: RequestUser,
    conversationId: string,
  ): AsyncGenerator<CoachChatStreamEvent> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }

    if (!(await this.conversations.isOwned(user.id, conversationId))) {
      throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    const origin = await this.conversations.getOrigin(user.id, conversationId);
    const community =
      origin?.type === "COMMUNITY_THREAD"
        ? await this.resolveCommunityContext(user.id, origin.refId).catch((err) => {
            this.logger.warn(`Community origin unavailable during regenerate: ${String(err)}`);
            return undefined;
          })
        : undefined;
    // Locate the final exchange by role rather than by position; legacy rows can share timestamps
    // and therefore have a UUID-based tie order.
    const tail = await this.messages.lastN(user.id, conversationId, 2);
    const userMsg = tail.find((m) => m.role === "USER");
    const coachMsg = tail.find((m) => m.role === "COACH");
    if (!userMsg || !coachMsg) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST);
    }

    const official = await this.resolveOfficialContent(
      user.id,
      userMsg.content,
    );
    if (official) {
      const updated = await this.messages.updateCoachReply(
        user.id,
        coachMsg.id,
        {
          content: official.reply,
          model: official.model,
          sources: official.sources,
          ...(official.officialCountdown
            ? { officialCountdown: official.officialCountdown }
            : {}),
        },
      );
      if (!updated) {
        throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      yield { done: { ...official, conversationId } };
      return;
    }

    await this.budget.assertWithinBudget();
    const spendRefId = randomUUID();
    let coinCost = 0;
    const ent = await this.entitlement.getEntitlement(user.id, user.roles);
    let shouldRefundOnFailure = false;

    if (ent.isPremium) {
      await this.assertPremiumRateLimit(user.id);
    } else {
      ({ cost: coinCost, shouldRefundOnFailure } = await this.prepareCoinSpend(
        user.id,
        spendRefId,
      ));
    }

    try {
      const { llmInput, sources } = await this.prepareChat(
        user.id,
        conversationId,
        userMsg.content,
        undefined,
        { excludeTailExchange: true },
        community,
      );
      const final = yield* this.streamLlm(llmInput);
      const { text: reply, task, followUps } = extractReplyMarkers(final.text);

      await this.usage.append({
        userId: user.id,
        model: final.model,
        feature: AiUsageFeature.CHAT,
        promptTokens: final.promptTokens,
        completionTokens: final.completionTokens,
        costMicros: estimateCostMicros(
          final.model,
          final.promptTokens,
          final.completionTokens,
        ),
      });
      const updated = await this.messages.updateCoachReply(
        user.id,
        coachMsg.id,
        {
          content: reply,
          model: final.model,
          sources,
          suggestedTask: task ?? undefined,
        },
      );
      if (!updated) {
        throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
      }

      yield {
        done: {
          reply,
          model: final.model,
          conversationId,
          sources,
          ...(task ? { suggestedTask: task } : {}),
          ...(followUps.length > 0 ? { followUps } : {}),
        },
      };
    } catch (err) {
      if (!ent.isPremium && shouldRefundOnFailure && coinCost > 0) {
        await this.refundCoinSpend(user.id, coinCost, spendRefId).catch(
          (refundErr) => {
            this.logger.error(
              `Coin refund failed after regenerate error: ${String(refundErr)}`,
            );
          },
        );
      }
      throw err;
    }
  }

  /** Marker-safe LLM streaming: yields clean deltas, returns the raw final result. */
  private async *streamLlm(llmInput: {
    system: string;
    user: string;
    history: LlmHistoryMessage[];
  }): AsyncGenerator<
    CoachChatStreamEvent,
    {
      text: string;
      promptTokens: number;
      completionTokens: number;
      model: string;
    }
  > {
    // The task/follow-up markers must never leak into deltas — the filter holds anything marker-like.
    const markerFilter = createTaskMarkerFilter();
    let final: {
      text: string;
      promptTokens: number;
      completionTokens: number;
      model: string;
    } | null = null;
    for await (const ev of this.llm.completeStream(llmInput)) {
      if (ev.delta) {
        const safe = markerFilter.push(ev.delta);
        if (safe) yield { delta: safe };
      }
      if (ev.final) final = ev.final;
    }
    if (!final) {
      throw new DomainError(
        ErrorCode.AI_PROVIDER_ERROR,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const held = markerFilter.flush();
    if (held) yield { delta: held };
    return final;
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
    const [result, origin] = await Promise.all([
      this.messages.listPagedByConversation(userId, conversationId, page, pageSize),
      this.conversations.getOrigin(userId, conversationId),
    ]);
    if (result.total === 0) {
      throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    const communitySource =
      origin?.type === "COMMUNITY_THREAD" && this.forumCoachBridge
        ? await this.forumCoachBridge
            .tryGetBridge(userId, origin.refId, I18nContext.current()?.lang ?? "tr")
            .catch((err) => {
              this.logger.warn(`Community source card unavailable: ${String(err)}`);
              return null;
            })
        : null;
    return { ...result, origin, communitySource };
  }

  /** DELETE /v1/coach/conversations/:id — drop one thread (messages cascade). Memory profile is kept. */
  async deleteConversation(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }
    const deleted = await this.conversations.delete(userId, conversationId);
    if (!deleted)
      throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
  }

  /** PATCH /v1/coach/messages/:id/feedback — 👍/👎/none on the user's own coach message. */
  async setMessageFeedback(
    userId: string,
    messageId: string,
    feedback: number | null,
  ): Promise<void> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }
    const ok = await this.messages.setFeedback(userId, messageId, feedback);
    if (!ok) throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
  }

  /** GET /v1/coach/memory — the coach's distilled profile of the user (null until built). */
  async getMemory(
    userId: string,
  ): Promise<{ summary: string; updatedAt: string } | null> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }
    const row = await this.memory.get(userId);
    return row
      ? { summary: row.summary, updatedAt: row.updatedAt.toISOString() }
      : null;
  }

  /** DELETE /v1/coach/memory — reset the profile (user-controlled, KVKK). */
  async clearMemory(userId: string): Promise<void> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }
    await this.memory.clear(userId);
  }
}
