import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { StreakSummaryDto } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { FREEZE_TOKENS_PER_MONTH, STREAK_LOOKBACK_DAYS } from "../domain/coaching.constants";
import { addDays, monthKey, todayIso } from "../domain/date.util";
import { deriveStreak } from "../domain/streak";
import { CoachingEventTopic, STREAK_MILESTONES, StreakBroken, StreakMilestone } from "../domain/coaching.events";
import { DailyActivityRepository } from "../infrastructure/daily-activity.repository";
import { StreakStateRepository } from "../infrastructure/streak-state.repository";

/**
 * Read-time streak derivation (MVP — no cron). The pure rules live in `domain/streak.ts`;
 * this service feeds them from `daily_activity` and persists a snapshot in `streak_state`
 * (longest is a high-water mark; freeze tokens are the monthly allowance minus this month's bridges).
 *
 * Path to W5: move this recompute behind `JobQueuePort` (`coaching.recompute-streak`, nightly).
 * Only the call site changes — the derivation is already pure and idempotent. This service does
 * NOT hard-depend on the (currently unbound) queue adapter.
 */
@Injectable()
export class StreakService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly activity: DailyActivityRepository,
    private readonly streak: StreakStateRepository,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Read-only current-streak snapshot (no recompute, no events) — for cross-module consumers like the
   * community effort board. The snapshot is refreshed by `getSummary` on the daily panel.
   * // ponytail: reads the cached snapshot; live-derive only if snapshot staleness ever matters here.
   */
  getCurrentStreak(userId: string): Promise<number> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.streak.findByUser(tx, userId);
      return row?.currentStreak ?? 0;
    });
  }

  async getSummary(userId: string): Promise<StreakSummaryDto> {
    const today = todayIso();
    const since = addDays(today, -STREAK_LOOKBACK_DAYS);
    const currentMonth = monthKey(today);

    let previousStreak = 0;
    let streakJustBroke = false;
    let milestoneReached: number | null = null;

    const result = await withUserContext(this.db, { userId }, async (tx) => {
      const activeDatesList = await this.activity.listActiveDatesSince(tx, userId, since);
      const activeDates = new Set(activeDatesList);

      const { currentStreak, bridgedDates } = deriveStreak(
        today,
        activeDates,
        FREEZE_TOKENS_PER_MONTH,
      );
      const usedThisMonth = bridgedDates.filter((d) => monthKey(d) === currentMonth).length;
      const freezeTokens = Math.max(0, FREEZE_TOKENS_PER_MONTH - usedThisMonth);

      const existing = await this.streak.findByUser(tx, userId);
      const longestStreak = Math.max(existing?.longestStreak ?? 0, currentStreak);
      const lastActiveDate =
        activeDatesList.length > 0
          ? activeDatesList.reduce((a, b) => (a > b ? a : b))
          : null;

      if (existing && existing.currentStreak > 0 && currentStreak === 0) {
        streakJustBroke = true;
        previousStreak = existing.currentStreak;
      }

      const prevStreak = existing?.currentStreak ?? 0;
      const crossed = STREAK_MILESTONES.find((m) => currentStreak >= m && prevStreak < m);
      if (crossed) milestoneReached = crossed;

      await this.streak.upsert(tx, userId, {
        currentStreak,
        longestStreak,
        freezeTokens,
        lastActiveDate,
        freezeMonth: currentMonth,
      });

      return { currentStreak, longestStreak, freezeTokens };
    });

    // Emit after tx commit — prevents event firing if upsert rolls back
    if (streakJustBroke) {
      this.events.emit(CoachingEventTopic.STREAK_BROKEN, new StreakBroken(userId, previousStreak));
    }
    if (milestoneReached !== null) {
      this.events.emit(CoachingEventTopic.STREAK_MILESTONE, new StreakMilestone(userId, milestoneReached));
    }

    return result;
  }
}
