import { createHash } from "node:crypto";
import { HttpStatus, Inject, Injectable, Optional } from "@nestjs/common";
import { WeeklyRecapService } from "./weekly-recap.service";
import { I18nContext } from "nestjs-i18n";
import type { RequestUser } from "../../../common/auth/current-user";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { WeeklyReviewService as CoachingWeeklyReviewService } from "../../coaching/application/weekly-review.service";
import { DeepAnalysisService } from "../../economy/application/deep-analysis.service";
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
import { WeeklyAnalysisAccessService } from "./weekly-analysis-access.service";
import { assertWithinFeatureDailyCap, withUserFeatureLock } from "./ai-generation-guard";

@Injectable()
export class WeeklyReviewNarrationService {
  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly config: ConfigRegistryService,
    private readonly entitlement: EntitlementService,
    private readonly deepAnalysis: DeepAnalysisService,
    private readonly coaching: CoachingWeeklyReviewService,
    private readonly cache: WeeklyReviewCacheRepository,
    private readonly usage: AiUsageRepository,
    private readonly budget: AiBudgetGuard,
    private readonly access: WeeklyAnalysisAccessService,
    @Optional() private readonly recaps?: WeeklyRecapService,
  ) {}

  async narrate(user: RequestUser, examId: string) {
    const saved = await this.recaps?.storedNarration(user.id, examId);
    if (saved) return saved;
    if (await this.config.get("coaching.weekly_recap.access_enabled")) {
      if (!this.recaps) throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
      return this.recaps.narration(user.id, examId);
    }
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }

    const locale = I18nContext.current()?.lang ?? "tr";

    return withUserFeatureLock(user.id, AiUsageFeature.WEEKLY_REVIEW, async () => {
      const entitlement = await this.entitlement.getEntitlement(user.id, user.roles);
      const evidence = await this.coaching.getAiEvidence(user.id, examId);
      if (evidence.review.status !== "READY") {
        throw new DomainError(
          ErrorCode.COACHING_WEEKLY_REVIEW_INSUFFICIENT,
          HttpStatus.BAD_REQUEST,
        );
      }
      // Premium includes the narration; free users pass with a taste flag, else coin unlock.
      if (!entitlement.isPremium) {
        const taste = await this.access.isIncluded(
          user.id,
          user.roles,
        );
        const unlocked =
          taste ||
          ((await this.config.get("economy.enabled")) &&
            (await this.deepAnalysis.isUnlocked(
              user.id,
              examId,
              evidence.review.period.startDate,
            )));
        if (!unlocked) {
          throw new DomainError(ErrorCode.PAYMENT_PREMIUM_REQUIRED, HttpStatus.FORBIDDEN);
        }
      }

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

      await assertWithinFeatureDailyCap(this.usage, user.id, AiUsageFeature.WEEKLY_REVIEW);

      const prompt = buildWeeklyReviewPrompt(evidence.review, locale);
      await this.budget.assertWithinBudget();
      const result = await this.llm.complete(prompt);
      await this.usage.append({
        ...(result.budgetReservationId ? { budgetReservationId: result.budgetReservationId } : {}),
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
    });
  }
}
