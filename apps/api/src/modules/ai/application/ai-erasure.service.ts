import { Injectable, Logger } from "@nestjs/common";
import { CoachConversationRepository } from "../infrastructure/coach-conversation.repository";
import { CoachMemoryRepository } from "../infrastructure/coach-memory.repository";
import { DailyGreetingRepository } from "../infrastructure/daily-greeting.repository";
import { WeeklyReviewCacheRepository } from "../infrastructure/weekly-review-cache.repository";

/**
 * KVKK erasure for the AI module (W3). Admin calls this via the user anonymize flow — the AI module
 * owns its own tables (workstreams §2), so admin never writes them directly.
 *
 * Erased: coach threads (messages + suggested tasks cascade), the distilled memory profile, the
 * cached weekly-review narrations, and the cached daily greetings — all of it is the user's own
 * words or AI text about them.
 * KEPT: `ai_usage` (token/cost meta only, no PII — needed for cost accounting §7).
 * Idempotent: re-running on an already-erased user is a no-op.
 */
@Injectable()
export class AiErasureService {
  private readonly logger = new Logger(AiErasureService.name);

  constructor(
    private readonly conversations: CoachConversationRepository,
    private readonly memory: CoachMemoryRepository,
    private readonly weeklyReviews: WeeklyReviewCacheRepository,
    private readonly dailyGreetings: DailyGreetingRepository,
  ) {}

  async eraseUserData(userId: string): Promise<void> {
    await this.conversations.deleteAllForUser(userId);
    await this.memory.deleteAllForUser(userId);
    await this.weeklyReviews.deleteAllForUser(userId);
    await this.dailyGreetings.deleteAllForUser(userId);
    this.logger.log(`AI data erased for user ${userId}`);
  }
}
