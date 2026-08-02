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
    const [counts, downrated, rawBreakdowns] = await Promise.all([
      this.messages.feedbackCounts(),
      this.messages.listDownrated(DOWNRATED_LIMIT),
      this.messages.feedbackBreakdowns(),
    ]);

    const denom = counts.up + counts.down;
    const satisfactionRate = denom > 0 ? counts.up / denom : null;

    return {
      up: counts.up,
      down: counts.down,
      rated: counts.rated,
      satisfactionRate,
      downrated,
      breakdowns: Object.fromEntries(
        Object.entries(rawBreakdowns).map(([key, items]) => [
          key,
          items.map((item) => ({
            ...item,
            satisfactionRate:
              item.rated > 0 ? item.up / (item.up + item.down) : null,
          })),
        ]),
      ) as AdminCoachFeedbackDto["breakdowns"],
      generatedAt: new Date().toISOString(),
    };
  }
}
