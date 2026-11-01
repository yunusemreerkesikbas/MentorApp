import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { WeeklyReviewDto, WeeklyReviewNarrationDto } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { LLM_PORT, type LlmPort } from "../domain/llm.port";
import { buildWeeklyReviewPrompt } from "../domain/weekly-review-prompt";
import { AiUsageFeature, estimateCostMicros } from "../domain/ai.constants";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import { WeeklyReviewCacheRepository } from "../infrastructure/weekly-review-cache.repository";

@Injectable()
export class WeeklyRecapNarratorService {
  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly usage: AiUsageRepository,
    private readonly cache: WeeklyReviewCacheRepository,
  ) {}

  async generate(userId: string, examId: string, review: WeeklyReviewDto, locale: string): Promise<{ locale: string; narration: WeeklyReviewNarrationDto }> {
    const cached = await this.cache.findAny(userId, examId, review.period.startDate);
    const suggestedTask = { subjectRef: review.focus?.subjectRef ?? null, title: review.suggestedTask?.title ?? review.recap.closingMessage };
    if (cached) return { locale: cached.locale, narration: { narration: cached.narration, model: "cache", suggestedTask } };
    const result = await this.llm.complete(buildWeeklyReviewPrompt(review, locale));
    await this.usage.append({
      ...(result.budgetReservationId ? { budgetReservationId: result.budgetReservationId } : {}),
      userId, model: result.model, feature: AiUsageFeature.WEEKLY_REVIEW,
      promptTokens: result.promptTokens, completionTokens: result.completionTokens,
      costMicros: estimateCostMicros(result.model, result.promptTokens, result.completionTokens),
    });
    if (!result.text.trim()) throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    return { locale, narration: { narration: result.text, model: result.model, suggestedTask } };
  }
}
