import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { I18nContext, I18nService } from "nestjs-i18n";
import type { MoodReflectionDto } from "@mentor/types";
import type { RequestUser } from "../../../common/auth/current-user";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { MoodService } from "../../coaching/application/mood.service";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { LLM_PORT, type LlmPort } from "../domain/llm.port";
import { hasSeriousDistressSignal } from "../domain/serious-distress";
import { AiUsageFeature, buildMoodReflectionPrompt, estimateCostMicros } from "../domain/ai.constants";
import { ContextBuilder } from "./context-builder.service";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import { AiBudgetGuard } from "./ai-budget.guard";

/**
 * Premium AI-adaptive reflection on today's mood check-in (W3 · §4 #5 premium-only — free tier
 * keeps the rule-based encouragement). Cost is bounded primarily by an idempotent daily cache:
 * a reflection is generated at most once per (user, day, mood value). Coaching clears the cache
 * when the mood changes, so an unchanged mood re-fetch costs nothing. The table write stays inside
 * coaching ({@link MoodService.setTodayAiReflection}) — AI never touches `mood_checkins` directly
 * (workstreams §2). Usage is metered into `ai_usage` (§7), counting toward the global premium AI
 * budget; precise per-feature caps are backlog (ai_usage isn't feature-labeled — devnote 0048).
 */
@Injectable()
export class MoodReflectionService {
  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly context: ContextBuilder,
    private readonly usage: AiUsageRepository,
    private readonly config: ConfigRegistryService,
    private readonly entitlement: EntitlementService,
    private readonly mood: MoodService,
    private readonly budget: AiBudgetGuard,
    private readonly i18n: I18nService,
  ) {}

  async reflect(user: RequestUser): Promise<MoodReflectionDto> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }

    const ent = await this.entitlement.getEntitlement(user.id, user.roles);
    if (!ent.isPremium) {
      throw new DomainError(ErrorCode.PAYMENT_PREMIUM_REQUIRED, HttpStatus.FORBIDDEN);
    }

    const today = await this.mood.getToday(user.id);
    if (!today) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST);
    }

    if (hasSeriousDistressSignal(today.struggleNote)) {
      const reflection = this.i18n.translate("coaching.mood.SERIOUS_DISTRESS", {
        lang: I18nContext.current()?.lang,
      }) as unknown as string;
      return { reflection, model: "safety" };
    }

    // Idempotent cache: reuse today's reflection (no LLM call / no cost) until the mood changes.
    if (today.aiReflection) {
      return { reflection: today.aiReflection, model: "cache" };
    }

    const ctx = await this.context.build(user.id);
    const { system, user: userMsg } = buildMoodReflectionPrompt(
      ctx,
      today.mood,
      today.struggleNote,
    );

    await this.budget.assertWithinBudget();
    const result = await this.llm.complete({ system, user: userMsg });

    await this.usage.append({
      userId: user.id,
      model: result.model,
      feature: AiUsageFeature.MOOD,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costMicros: estimateCostMicros(result.model, result.promptTokens, result.completionTokens),
    });

    await this.mood.setTodayAiReflection(user.id, result.text, result.model);

    return { reflection: result.text, model: result.model };
  }
}
