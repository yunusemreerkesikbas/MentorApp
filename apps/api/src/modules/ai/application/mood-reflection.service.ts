import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { MoodReflectionDto } from "@mentor/types";
import type { RequestUser } from "../../../common/auth/current-user";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { MoodService } from "../../coaching/application/mood.service";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { LLM_PORT, type LlmPort } from "../domain/llm.port";
import { buildMoodReflectionPrompt, estimateCostMicros } from "../domain/ai.constants";
import { ContextBuilder } from "./context-builder.service";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";

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

    const result = await this.llm.complete({ system, user: userMsg });

    await this.usage.append({
      userId: user.id,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costMicros: estimateCostMicros(result.model, result.promptTokens, result.completionTokens),
    });

    await this.mood.setTodayAiReflection(user.id, result.text, result.model);

    return { reflection: result.text, model: result.model };
  }
}
