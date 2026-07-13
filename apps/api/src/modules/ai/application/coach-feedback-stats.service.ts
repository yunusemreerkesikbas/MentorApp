import { Injectable } from "@nestjs/common";
import type { AdminCoachFeedbackDto } from "@mentor/types";
import { CoachMessageRepository } from "../infrastructure/coach-message.repository";

/** How many recent 👎 replies the admin report lists. */
const DOWNRATED_LIMIT = 20;

/**
 * Admin coach-feedback report: turns the Dilim 6 👍/👎 signal into a satisfaction rate + a list of
 * the most recent 👎 replies (with the question that prompted each). Read-only, cross-tenant
 * (SERVICE ctx inside the repo). Message text is behavioral free-text — admin-only.
 */
@Injectable()
export class CoachFeedbackStatsService {
  constructor(private readonly messages: CoachMessageRepository) {}

  async getFeedbackStats(): Promise<AdminCoachFeedbackDto> {
    const [counts, downrated] = await Promise.all([
      this.messages.feedbackCounts(),
      this.messages.listDownrated(DOWNRATED_LIMIT),
    ]);

    const denom = counts.up + counts.down;
    const satisfactionRate = denom > 0 ? counts.up / denom : null;

    return {
      up: counts.up,
      down: counts.down,
      rated: counts.rated,
      satisfactionRate,
      downrated,
      generatedAt: new Date().toISOString(),
    };
  }
}
