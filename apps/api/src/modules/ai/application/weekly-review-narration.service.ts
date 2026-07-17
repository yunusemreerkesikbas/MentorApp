import { createHash } from "node:crypto";
import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
import type { RequestUser } from "../../../common/auth/current-user";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { WeeklyReviewService as CoachingWeeklyReviewService } from "../../coaching/application/weekly-review.service";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { LLM_PORT, type LlmPort } from "../domain/llm.port";
import {
  buildWeeklyReviewPrompt,
  WEEKLY_REVIEW_PROMPT_VERSION,
} from "../domain/weekly-review-prompt";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import { AiBudgetGuard } from "./ai-budget.guard";
import { WeeklyReviewCacheRepository } from "../infrastructure/weekly-review-cache.repository";
import { AiUsageFeature, estimateCostMicros } from "../domain/ai.constants";

@Injectable()
export class WeeklyReviewNarrationService {
  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly config: ConfigRegistryService,
    private readonly entitlement: EntitlementService,
    private readonly coaching: CoachingWeeklyReviewService,
    private readonly cache: WeeklyReviewCacheRepository,
    private readonly usage: AiUsageRepository,
    private readonly budget: AiBudgetGuard,
  ) {}

  async narrate(user: RequestUser, examId: string) {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }
    const entitlement = await this.entitlement.getEntitlement(user.id, user.roles);
    if (!entitlement.isPremium) {
      throw new DomainError(ErrorCode.PAYMENT_PREMIUM_REQUIRED, HttpStatus.FORBIDDEN);
    }

    const evidence = await this.coaching.getAiEvidence(user.id, examId);
    if (evidence.review.status !== "READY") {
      throw new DomainError(
        ErrorCode.COACHING_WEEKLY_REVIEW_INSUFFICIENT,
        HttpStatus.BAD_REQUEST,
      );
    }

    const locale = I18nContext.current()?.lang ?? "tr";
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({
        version: WEEKLY_REVIEW_PROMPT_VERSION,
        locale,
        evidence: evidence.fingerprintInput,
      }))
      .digest("hex");
    const cached = await this.cache.find(
      user.id,
      examId,
      evidence.review.period.startDate,
      locale,
    );
    if (cached?.sourceFingerprint === fingerprint) {
      return {
        narration: cached.narration,
        model: "cache",
        suggestedTask: evidence.suggestedTask,
      };
    }

    const prompt = buildWeeklyReviewPrompt(evidence.review, locale);
    await this.budget.assertWithinBudget();
    const result = await this.llm.complete(prompt);
    await this.usage.append({
      userId: user.id,
      model: result.model,
      feature: AiUsageFeature.WEEKLY_REVIEW,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costMicros: estimateCostMicros(result.model, result.promptTokens, result.completionTokens),
    });
    await this.cache.upsert({
      userId: user.id,
      examId,
      weekStart: evidence.review.period.startDate,
      locale,
      sourceFingerprint: fingerprint,
      narration: result.text,
      model: result.model,
    });

    return {
      narration: result.text,
      model: result.model,
      suggestedTask: evidence.suggestedTask,
    };
  }
}

