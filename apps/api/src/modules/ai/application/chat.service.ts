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
  type CoachPersonalizationDto,
  CoachActionStatus,
  CoachActionType,
  CoachPersonalizationMode,
  CoachTurnMode,
  CoachIntent,
  type CoachActionDto,
  type CoachProfileDto,
  type CoachMemoryFactDto,
} from "@mentor/types";
import type { RequestUser } from "../../../common/auth/current-user";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ContentService } from "../../content/application/content.service";
import { ExamEventType } from "../../content/domain/content.constants";
import { MockExamService } from "../../coaching/application/mock-exam.service";
import { CoachEvidenceService } from "../../coaching/application/coach-evidence.service";
import type { CoachEvidenceSnapshot } from "../../coaching/domain/coach-evidence";
import { EconomyService } from "../../economy/application/economy.service";
import { EconomyLedger } from "../../economy/domain/economy.constants";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { PremiumFeatureId } from "@mentor/types";
import {
  LLM_PORT,
  type LlmHistoryMessage,
  type LlmPort,
} from "../domain/llm.port";
import {
  AiUsageFeature,
  buildConversationTitle,
  buildCoachPersonalization,
  buildSystemPrompt,
  estimateCostMicros,
  RAG_MAX_DISTANCE,
  RAG_TOP_K,
} from "../domain/ai.constants";
import {
  createTaskMarkerFilter,
  extractReplyMarkers,
  type MemoryCandidate,
} from "../domain/suggested-task";
import { classifyOfficialIntent } from "../domain/official-intent";
import {
  applyCoachPersonalizationMarker,
  createPersonalizationMarkerFilter,
  enforceNeedsInputReply,
} from "../domain/personalization-marker";
import { promptLocale, type PromptLocale } from "../domain/prompt-locale";
import { hasSeriousDistressSignal } from "../domain/serious-distress";
import {
  boundChatHistory,
  buildMentorV2Prompt,
  isMentorV2Enabled,
} from "../domain/mentor-v2-prompt";
import {
  CoachTurnPlanner,
  type CoachTurnPlan,
} from "../domain/coach-turn-planner";
import { ContextBuilder } from "./context-builder.service";
import { PremiumFeatureGateService } from "./premium-feature-gate.service";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import {
  CoachMessageRepository,
  type CoachConversationTarget,
  type PersistedCoachExchange,
  type CoachRequestContext,
} from "../infrastructure/coach-message.repository";
import { CoachMemoryRepository } from "../infrastructure/coach-memory.repository";
import { CoachConversationRepository } from "../infrastructure/coach-conversation.repository";
import { AiBudgetGuard } from "./ai-budget.guard";
import { CoachProfileService } from "./coach-profile.service";
import {
  ForumCoachBridgeService,
  type ForumCoachContext,
} from "../../forum/application/forum-coach-bridge.service";

export type CoachReplyResult = CoachChatReplyDto;
type OfficialContent = Omit<CoachReplyResult, "conversationId">;
type MentorV2Context = {
  profile: CoachProfileDto;
  snapshot: CoachEvidenceSnapshot;
  memories: CoachMemoryFactDto[];
  turn: CoachTurnPlan;
};

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
    @Optional() private readonly evidence?: CoachEvidenceService,
    @Optional() private readonly profiles?: CoachProfileService,
    @Optional() private readonly turnPlanner?: CoachTurnPlanner,
    @Optional() private readonly featureGate?: PremiumFeatureGateService,
  ) {}

  /** Keeps legacy repository test doubles/rolling deployments readable during the additive change. */
  private persistedIds(value: PersistedCoachExchange): {
    conversationId: string;
    userMessageId?: string;
    coachMessageId?: string;
  } {
    if (typeof (value as unknown) === "string") {
      return { conversationId: value as unknown as string };
    }
    return value;
  }

  private async mentorV2Context(
    user: RequestUser,
    message: string,
  ): Promise<MentorV2Context | null> {
    if (!this.evidence || !this.profiles || !this.turnPlanner) return null;
    const configured = await this.config.get(
      "ai.coach_personalization_v2.rollout_percent",
    );
    const rolloutPercent = typeof configured === "number" ? configured : 0;
    if (!isMentorV2Enabled(user.id, user.roles, rolloutPercent)) return null;

    const [snapshot, profile] = await Promise.all([
      this.evidence.build(user.id),
      this.profiles.getProfile(user.id),
    ]);
    const memories =
      profile.memoryConsent === "GRANTED"
        ? await this.profiles.getPromptMemories(user.id)
        : [];
    return {
      snapshot,
      profile,
      memories,
      turn: this.turnPlanner.plan({
        message,
        profile,
        moodLevel: snapshot.moodLevel,
        availableEvidence: snapshot.evidence,
        pendingAiCoachPlanTaskId: snapshot.pendingAiCoachPlanTaskId,
      }),
    };
  }

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
          undefined,
          ctx.examVariant,
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
    const coach = {
        content: official.reply,
        model: official.model,
        sources: official.sources,
        ...(official.officialCountdown
          ? { officialCountdown: official.officialCountdown }
          : {}),
      };
    const persistedRaw = contextArticleSlug
      ? await this.messages.persistExchange(userId, target, message, coach, {
          articleSlug: contextArticleSlug,
        })
      : await this.messages.persistExchange(userId, target, message, coach);
    const persisted = this.persistedIds(persistedRaw);
    return {
      ...official,
      conversationId: persisted.conversationId,
      ...(persisted.coachMessageId
        ? { coachMessageId: persisted.coachMessageId }
        : {}),
    };
  }

  private v2Personalization(context: MentorV2Context): CoachPersonalizationDto {
    return {
      mode:
        context.turn.usedEvidence.length > 0
          ? CoachPersonalizationMode.GROUNDED
          : CoachPersonalizationMode.NEEDS_INPUT,
      examType: context.snapshot.examType,
      moodLevel: context.snapshot.moodLevel,
      recentSessions: null,
      todayPlan: null,
      usedSignals: [],
      strategyVersion: context.turn.strategyVersion,
      intent: context.turn.intent,
      tone: context.turn.tone,
      usedEvidence: context.turn.usedEvidence,
    };
  }

  private async buildAction(
    context: MentorV2Context | null,
    task?: { title: string; subject: string | null },
  ): Promise<CoachActionDto | undefined> {
    if (!context) return undefined;
    if (
      context.turn.allowedAction === CoachActionType.OPEN_PLAN_ADAPTATION
    ) {
      return {
        type: CoachActionType.OPEN_PLAN_ADAPTATION,
        label: this.i18n.translate("coaching.mentorV2.openPlanAdaptation", {
          lang: I18nContext.current()?.lang,
        }) as unknown as string,
        payload: { source: "PLAN" },
      };
    }
    if (
      context.turn.allowedAction === CoachActionType.START_PLAN_SESSION &&
      context.snapshot.pendingAiCoachPlanTaskId
    ) {
      return {
        type: CoachActionType.START_PLAN_SESSION,
        label: this.i18n.translate("coaching.mentorV2.startSession", {
          lang: I18nContext.current()?.lang,
        }) as unknown as string,
        payload: {
          planTaskId: context.snapshot.pendingAiCoachPlanTaskId,
        },
      };
    }
    if (
      context.turn.allowedAction === CoachActionType.CREATE_PLAN_TASK &&
      task
    ) {
      let subject: string | null = null;
      if (task.subject && context.snapshot.examType) {
        try {
          const calendar = await this.content.getExamCalendarByFamily(
            context.snapshot.examType,
          );
          const taxonomy = calendar
            ? await this.content.listExamSubjectsByExamId(calendar.exam.id)
            : [];
          const normalized = task.subject.trim().toLocaleLowerCase("tr-TR");
          subject =
            taxonomy.find(
              (item) =>
                item.slug.toLocaleLowerCase("tr-TR") === normalized ||
                item.name.toLocaleLowerCase("tr-TR") === normalized,
            )?.name ?? null;
        } catch (error) {
          this.logger.warn({
            event: "coach_action_taxonomy_unavailable",
            error: error instanceof Error ? error.name : "unknown",
          });
        }
      }
      return {
        type: CoachActionType.CREATE_PLAN_TASK,
        label: this.i18n.translate("coaching.mentorV2.createTask", {
          lang: I18nContext.current()?.lang,
        }) as unknown as string,
        payload: { ...task, subject },
      };
    }
    if (context.turn.allowedAction !== CoachActionType.NAVIGATE) return undefined;
    if (context.turn.intent === CoachIntent.PERFORMANCE) {
      return {
        type: CoachActionType.NAVIGATE,
        label: this.i18n.translate("coaching.mentorV2.openAnalysis", {
          lang: I18nContext.current()?.lang,
        }) as unknown as string,
        payload: { destination: "ANALYSIS" },
      };
    }
    if (context.turn.intent === CoachIntent.GOAL) {
      return {
        type: CoachActionType.NAVIGATE,
        label: this.i18n.translate("coaching.mentorV2.openGoal", {
          lang: I18nContext.current()?.lang,
        }) as unknown as string,
        payload: { destination: "GOAL" },
      };
    }
    if (context.turn.intent === CoachIntent.CHECK_IN) {
      return {
        type: CoachActionType.NAVIGATE,
        label: this.i18n.translate("coaching.mentorV2.openMood", {
          lang: I18nContext.current()?.lang,
        }) as unknown as string,
        payload: { destination: "MOOD" },
      };
    }
    return undefined;
  }

  private async completeLocalExchange(
    userId: string,
    target: CoachConversationTarget,
    message: string,
    reply: string,
    model: string,
    personalization?: CoachPersonalizationDto,
  ): Promise<CoachReplyResult> {
    const persisted = this.persistedIds(
      await this.messages.persistExchange(userId, target, message, {
        content: reply,
        model,
        sources: [],
        ...(personalization ? { personalization } : {}),
      }),
    );
    return {
      reply,
      model,
      sources: [],
      conversationId: persisted.conversationId,
      ...(persisted.coachMessageId
        ? { coachMessageId: persisted.coachMessageId }
        : {}),
      ...(personalization ? { personalization } : {}),
    };
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
    const mentorV2 = await this.mentorV2Context(user, message);
    if (
      hasSeriousDistressSignal(message) ||
      mentorV2?.turn.mode === CoachTurnMode.SAFETY
    ) {
      const target = await this.resolveConversationTarget(
        user.id,
        message,
        conversationId,
        community,
      );
      return this.completeLocalExchange(
        user.id,
        target,
        message,
        this.i18n.translate("coaching.mood.SERIOUS_DISTRESS", {
          lang: I18nContext.current()?.lang,
        }) as unknown as string,
        "verified-safety",
        mentorV2 ? this.v2Personalization(mentorV2) : undefined,
      );
    }
    if (mentorV2?.turn.mode === CoachTurnMode.CALIBRATE) {
      const target = await this.resolveConversationTarget(
        user.id,
        message,
        conversationId,
        community,
      );
      return this.completeLocalExchange(
        user.id,
        target,
        message,
        this.i18n.translate("coaching.mentorV2.calibration", {
          lang: I18nContext.current()?.lang,
        }) as unknown as string,
        "mentor-calibration",
        this.v2Personalization(mentorV2),
      );
    }
    await this.budget.assertWithinBudget();

    const spendRefId = clientMessageId ?? randomUUID();
    const { isPremium, coinCost, shouldRefundOnFailure } =
      await this.authorizeChatSpend(user, spendRefId);

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
        mentorV2,
        {
          ...(contextMockExamId ? { mockExamId: contextMockExamId } : {}),
          ...(contextArticleSlug ? { articleSlug: contextArticleSlug } : {}),
        },
      );
    } catch (err) {
      if (!isPremium && shouldRefundOnFailure && coinCost > 0) {
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

  private async authorizeChatSpend(
    user: RequestUser,
    spendRefId: string,
  ): Promise<{
    isPremium: boolean;
    coinCost: number;
    shouldRefundOnFailure: boolean;
  }> {
    const ent = await this.entitlement.getEntitlement(user.id, user.roles);
    if (ent.isPremium) {
      await this.assertPremiumRateLimit(user.id);
      return { isPremium: true, coinCost: 0, shouldRefundOnFailure: false };
    }
    if (
      this.featureGate &&
      (await this.featureGate.isAllowed(
        user.id,
        user.roles,
        PremiumFeatureId.COACH_CHAT,
      ))
    ) {
      return { isPremium: false, coinCost: 0, shouldRefundOnFailure: false };
    }
    const spend = await this.prepareCoinSpend(user.id, spendRefId);
    return {
      isPremium: false,
      coinCost: spend.cost,
      shouldRefundOnFailure: spend.shouldRefundOnFailure,
    };
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
    mentorV2?: MentorV2Context | null,
  ) {
    const legacyContext = mentorV2 ? null : await this.context.build(userId);
    const personalization = mentorV2
      ? this.v2Personalization(mentorV2)
      : buildCoachPersonalization(legacyContext!);
    const examType = mentorV2?.snapshot.examType ?? legacyContext?.examType ?? null;
    const [historyMax, historyMaxCharacters] = await Promise.all([
      this.config.get("ai.coach.history_max_messages"),
      this.config.get("ai.coach.history_max_characters"),
    ]);

    // Multi-turn: replay the last N messages OF THIS THREAD (the user's own words + earlier coach
    // replies — no third-party PII, §4 #6). Defensive: a history failure never blocks the chat.
    // Regenerate excludes the tail USER+COACH pair — the model must not anchor on the reply being
    // replaced, and the user message is re-sent as the live prompt.
    const history: LlmHistoryMessage[] = conversationId
      ? await this.messages
          .lastN(userId, conversationId, historyMax)
          .then((rows) =>
            opts?.excludeTailExchange ? rows.slice(0, -2) : rows,
          )
          .then((rows) =>
            boundChatHistory(
              rows.map((m) => ({
                role:
                  m.role === "USER"
                    ? ("user" as const)
                    : ("assistant" as const),
                content: m.content,
              })),
              historyMax,
              historyMaxCharacters,
            ),
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
    if (examType) {
      try {
        if (opts?.contextArticleSlug) {
          const exact = await this.content.getInfoArticleSource(
            opts.contextArticleSlug,
            examType,
          );
          if (exact) retrieved = [exact];
        }
      } catch (err) {
        this.logger.warn(`RAG retrieval skipped: ${String(err)}`);
      }
    }

    const locale = promptLocale(I18nContext.current()?.lang);
    const system = mentorV2
      ? buildMentorV2Prompt({
          locale,
          turn: mentorV2.turn,
          memories: mentorV2.memories,
          memoryEnabled: mentorV2.profile.memoryConsent === "GRANTED",
          sources: retrieved,
          mockExam,
          community,
        })
      : buildSystemPrompt(
          legacyContext!,
          retrieved,
          mockExam,
          locale,
          community,
        );

    return {
      llmInput: { system, user: message, history },
      sources: retrieved.map((s) => ({
        title: s.title,
        slug: s.slug,
        url: s.sourceUrl,
      })),
      personalization,
      locale,
      mentorV2: mentorV2 ?? null,
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
    personalization: CoachPersonalizationDto,
    suggestedTask?: { title: string; subject: string | null },
    options?: {
      action?: CoachActionDto;
      requestContext?: CoachRequestContext;
      memoryCandidate?: MemoryCandidate;
      learnMemory?: boolean;
    },
  ): Promise<{
    conversationId: string;
    userMessageId?: string;
    coachMessageId?: string;
  }> {
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

    const coach = {
      content: result.text,
      model: result.model,
      sources,
      personalization,
      suggestedTask,
      ...(options?.action ? { action: options.action } : {}),
    };
    const persistedRaw = options?.requestContext && Object.keys(options.requestContext).length > 0
      ? await this.messages.persistExchange(
          userId,
          target,
          message,
          coach,
          options.requestContext,
        )
      : await this.messages.persistExchange(userId, target, message, coach);
    const persisted = this.persistedIds(persistedRaw);
    if (options?.learnMemory && this.profiles && persisted.userMessageId) {
      try {
        await this.profiles.learnFromChat(
          userId,
          persisted.userMessageId,
          message,
          options.memoryCandidate,
        );
      } catch (error) {
        this.logger.warn({
          event: "coach_memory_learning_failed",
          error: error instanceof Error ? error.name : "unknown",
        });
      }
    }
    return persisted;
  }
  private async completeChat(
    userId: string,
    target: CoachConversationTarget,
    message: string,
    mockExam?: MockExamDto,
    contextArticleSlug?: string,
    community?: ForumCoachContext,
    mentorV2?: MentorV2Context | null,
    requestContext?: CoachRequestContext,
  ): Promise<CoachReplyResult> {
    const { llmInput, sources, personalization, locale } = await this.prepareChat(
      userId,
      target.kind === "existing" ? target.conversationId : undefined,
      message,
      mockExam,
      { contextArticleSlug },
      community,
      mentorV2,
    );
    const result = await this.llm.complete(llmInput);
    // Order-agnostic: models sometimes reverse the FOLLOWUP/TASK order — never leak a marker.
    const markers = extractReplyMarkers(result.text);
    const personalized = mentorV2
      ? { text: markers.text.trim(), personalization }
      : applyCoachPersonalizationMarker(markers.text, personalization, locale);
    const reply = mentorV2
      ? personalized.text
      : enforceNeedsInputReply(
          personalized.text,
          personalized.personalization.mode,
          locale,
        );
    const { task, followUps, memoryCandidate } = markers;
    const action = await this.buildAction(mentorV2 ?? null, task ?? undefined);
    const persisted = await this.recordSuccess(
      userId,
      target,
      message,
      { ...result, text: reply },
      sources,
      personalized.personalization,
      task ?? undefined,
      {
        ...(action ? { action } : {}),
        ...(requestContext && Object.keys(requestContext).length > 0
          ? { requestContext }
          : {}),
        ...(memoryCandidate ? { memoryCandidate } : {}),
        learnMemory: Boolean(mentorV2),
      },
    );
    return {
      reply,
      model: result.model,
      conversationId: persisted.conversationId,
      ...(persisted.coachMessageId
        ? { coachMessageId: persisted.coachMessageId }
        : {}),
      sources,
      personalization: personalized.personalization,
      ...(task ? { suggestedTask: task } : {}),
      ...(action
        ? { action, actionStatus: CoachActionStatus.PROPOSED }
        : {}),
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

    const mentorV2 = await this.mentorV2Context(user, message);
    if (
      hasSeriousDistressSignal(message) ||
      mentorV2?.turn.mode === CoachTurnMode.SAFETY
    ) {
      const target = await this.resolveConversationTarget(
        user.id,
        message,
        conversationId,
        community,
      );
      yield {
        done: await this.completeLocalExchange(
          user.id,
          target,
          message,
          this.i18n.translate("coaching.mood.SERIOUS_DISTRESS", {
            lang: I18nContext.current()?.lang,
          }) as unknown as string,
          "verified-safety",
          mentorV2 ? this.v2Personalization(mentorV2) : undefined,
        ),
      };
      return;
    }
    if (mentorV2?.turn.mode === CoachTurnMode.CALIBRATE) {
      const target = await this.resolveConversationTarget(
        user.id,
        message,
        conversationId,
        community,
      );
      yield {
        done: await this.completeLocalExchange(
          user.id,
          target,
          message,
          this.i18n.translate("coaching.mentorV2.calibration", {
            lang: I18nContext.current()?.lang,
          }) as unknown as string,
          "mentor-calibration",
          this.v2Personalization(mentorV2),
        ),
      };
      return;
    }

    await this.budget.assertWithinBudget();
    const spendRefId = clientMessageId ?? randomUUID();
    const { isPremium, coinCost, shouldRefundOnFailure } =
      await this.authorizeChatSpend(user, spendRefId);

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
      const { llmInput, sources, personalization, locale } = await this.prepareChat(
        user.id,
        target.kind === "existing" ? target.conversationId : undefined,
        message,
        mockExam,
        { contextArticleSlug },
        community,
        mentorV2,
      );
      const final = yield* this.streamLlm(
        llmInput,
        personalization,
        locale,
        Boolean(mentorV2),
      );
      const markers = extractReplyMarkers(final.text);
      const personalized = mentorV2
        ? { text: markers.text.trim(), personalization }
        : applyCoachPersonalizationMarker(markers.text, personalization, locale);
      const reply = mentorV2
        ? personalized.text
        : enforceNeedsInputReply(
            personalized.text,
            personalized.personalization.mode,
            locale,
          );
      const { task, followUps, memoryCandidate } = markers;
      const action = await this.buildAction(mentorV2, task ?? undefined);
      if (!mentorV2 && personalization.mode === "NEEDS_INPUT") {
        yield { delta: reply };
      }
      const persisted = await this.recordSuccess(
        user.id,
        target,
        message,
        { ...final, text: reply },
        sources,
        personalized.personalization,
        task ?? undefined,
        {
          ...(action ? { action } : {}),
          requestContext: {
            ...(contextMockExamId ? { mockExamId: contextMockExamId } : {}),
            ...(contextArticleSlug ? { articleSlug: contextArticleSlug } : {}),
          },
          ...(memoryCandidate ? { memoryCandidate } : {}),
          learnMemory: Boolean(mentorV2),
        },
      );
      yield {
        done: {
          reply,
          model: final.model,
          conversationId: persisted.conversationId,
          ...(persisted.coachMessageId
            ? { coachMessageId: persisted.coachMessageId }
            : {}),
          sources,
          personalization: personalized.personalization,
          ...(task ? { suggestedTask: task } : {}),
          ...(action
            ? { action, actionStatus: CoachActionStatus.PROPOSED }
            : {}),
          ...(followUps.length > 0 ? { followUps } : {}),
        },
      };
    } catch (err) {
      if (!isPremium && shouldRefundOnFailure && coinCost > 0) {
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
    if (
      coachMsg.actionStatus === CoachActionStatus.ACCEPTED ||
      coachMsg.actionStatus === CoachActionStatus.COMPLETED
    ) {
      throw new DomainError(ErrorCode.CONFLICT, HttpStatus.CONFLICT);
    }

    const requestContext = this.messages.getRequestContext
      ? await this.messages.getRequestContext(user.id, userMsg.id)
      : null;
    let regeneratedMockExam: MockExamDto | undefined;
    if (requestContext?.mockExamId) {
      try {
        regeneratedMockExam = await this.mockExams.getById(
          user.id,
          requestContext.mockExamId,
        );
      } catch {
        throw new DomainError(
          ErrorCode.AI_COACH_CONTEXT_STALE,
          HttpStatus.CONFLICT,
        );
      }
    }
    if (requestContext?.articleSlug) {
      const current = await this.context.build(user.id);
      const exact = current.examType
        ? await this.content.getInfoArticleSource(
            requestContext.articleSlug,
            current.examType,
          )
        : null;
      if (!exact) {
        throw new DomainError(
          ErrorCode.AI_COACH_CONTEXT_STALE,
          HttpStatus.CONFLICT,
        );
      }
    }

    const official = await this.resolveOfficialContent(
      user.id,
      userMsg.content,
      requestContext?.articleSlug,
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
      yield {
        done: { ...official, conversationId, coachMessageId: coachMsg.id },
      };
      return;
    }

    const mentorV2 = await this.mentorV2Context(user, userMsg.content);
    if (
      hasSeriousDistressSignal(userMsg.content) ||
      mentorV2?.turn.mode === CoachTurnMode.SAFETY
    ) {
      const reply = this.i18n.translate("coaching.mood.SERIOUS_DISTRESS", {
        lang: I18nContext.current()?.lang,
      }) as unknown as string;
      const personalization = mentorV2
        ? this.v2Personalization(mentorV2)
        : undefined;
      const updated = await this.messages.updateCoachReply(user.id, coachMsg.id, {
        content: reply,
        model: "verified-safety",
        sources: [],
        ...(personalization ? { personalization } : {}),
      });
      if (!updated) throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
      yield {
        done: {
          reply,
          model: "verified-safety",
          conversationId,
          coachMessageId: coachMsg.id,
          sources: [],
          ...(personalization ? { personalization } : {}),
        },
      };
      return;
    }
    if (mentorV2?.turn.mode === CoachTurnMode.CALIBRATE) {
      const reply = this.i18n.translate("coaching.mentorV2.calibration", {
        lang: I18nContext.current()?.lang,
      }) as unknown as string;
      const personalization = this.v2Personalization(mentorV2);
      const updated = await this.messages.updateCoachReply(user.id, coachMsg.id, {
        content: reply,
        model: "mentor-calibration",
        sources: [],
        personalization,
      });
      if (!updated) throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
      yield {
        done: {
          reply,
          model: "mentor-calibration",
          conversationId,
          coachMessageId: coachMsg.id,
          sources: [],
          personalization,
        },
      };
      return;
    }

    await this.budget.assertWithinBudget();
    const spendRefId = randomUUID();
    const { isPremium, coinCost, shouldRefundOnFailure } =
      await this.authorizeChatSpend(user, spendRefId);

    try {
      const { llmInput, sources, personalization, locale } = await this.prepareChat(
        user.id,
        conversationId,
        userMsg.content,
        regeneratedMockExam,
        {
          excludeTailExchange: true,
          ...(requestContext?.articleSlug
            ? { contextArticleSlug: requestContext.articleSlug }
            : {}),
        },
        community,
        mentorV2,
      );
      const final = yield* this.streamLlm(
        llmInput,
        personalization,
        locale,
        Boolean(mentorV2),
      );
      const markers = extractReplyMarkers(final.text);
      const personalized = mentorV2
        ? { text: markers.text.trim(), personalization }
        : applyCoachPersonalizationMarker(markers.text, personalization, locale);
      const reply = mentorV2
        ? personalized.text
        : enforceNeedsInputReply(
            personalized.text,
            personalized.personalization.mode,
            locale,
          );
      const { task, followUps } = markers;
      const action = await this.buildAction(mentorV2, task ?? undefined);
      if (!mentorV2 && personalization.mode === "NEEDS_INPUT") {
        yield { delta: reply };
      }

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
          personalization: personalized.personalization,
          suggestedTask: task ?? undefined,
          ...(action ? { action } : {}),
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
          coachMessageId: coachMsg.id,
          sources,
          personalization: personalized.personalization,
          ...(task ? { suggestedTask: task } : {}),
          ...(action
            ? { action, actionStatus: CoachActionStatus.PROPOSED }
            : {}),
          ...(followUps.length > 0 ? { followUps } : {}),
        },
      };
    } catch (err) {
      if (!isPremium && shouldRefundOnFailure && coinCost > 0) {
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
  }, personalization: CoachPersonalizationDto, locale: PromptLocale, mentorV2 = false): AsyncGenerator<
    CoachChatStreamEvent,
    {
      text: string;
      promptTokens: number;
      completionTokens: number;
      model: string;
    }
  > {
    // The task/follow-up markers must never leak into deltas — the filter holds anything marker-like.
    const personalizationFilter = mentorV2
      ? null
      : createPersonalizationMarkerFilter(personalization, locale);
    const bufferUntilValidated =
      !mentorV2 && personalization.mode === "NEEDS_INPUT";
    const markerFilter = createTaskMarkerFilter();
    let final: {
      text: string;
      promptTokens: number;
      completionTokens: number;
      model: string;
    } | null = null;
    for await (const ev of this.llm.completeStream(llmInput)) {
      if (ev.delta) {
        const personalized = personalizationFilter
          ? personalizationFilter.push(ev.delta)
          : ev.delta;
        const safe = personalized ? markerFilter.push(personalized) : "";
        if (safe && !bufferUntilValidated) yield { delta: safe };
      }
      if (ev.final) final = ev.final;
    }
    if (!final) {
      throw new DomainError(
        ErrorCode.AI_PROVIDER_ERROR,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const personalizationHeld = personalizationFilter?.flush() ?? "";
    if (personalizationHeld) {
      const safe = markerFilter.push(personalizationHeld);
      if (safe && !bufferUntilValidated) yield { delta: safe };
    }
    const held = markerFilter.flush();
    if (held && !bufferUntilValidated) yield { delta: held };
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
