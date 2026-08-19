import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { WeeklyReviewCompletionDto } from "@mentor/types";
import type { CompleteWeeklyReviewInput } from "@mentor/validation";
import { ValidationFailedError } from "../../../common/errors/domain-error";
import { CoachingEventTopic, WeeklyReviewCompleted } from "../domain/coaching.events";
import { WeeklyReviewCompletionRepository } from "../infrastructure/weekly-review-completion.repository";
import { WeeklyReviewService } from "./weekly-review.service";

@Injectable()
export class WeeklyReviewCompletionService {
  constructor(
    private readonly reviews: WeeklyReviewService,
    private readonly completions: WeeklyReviewCompletionRepository,
    private readonly events: EventEmitter2,
  ) {}

  async complete(
    userId: string,
    input: CompleteWeeklyReviewInput,
  ): Promise<WeeklyReviewCompletionDto> {
    const review = await this.reviews.getReview(userId, input.examId);
    if (review.status !== "READY" || review.period.startDate !== input.weekStart) {
      throw new ValidationFailedError({ reason: "weekly_review_not_ready" });
    }
    const result = await this.completions.upsert(userId, input.examId, input.weekStart);
    if (result.inserted) {
      this.events.emit(
        CoachingEventTopic.WEEKLY_REVIEW_COMPLETED,
        new WeeklyReviewCompleted(userId, result.row.completedAt),
      );
    }
    return {
      examId: result.row.examId,
      weekStart: result.row.weekStart,
      completedAt: result.row.completedAt.toISOString(),
    };
  }
}
