import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { I18nContext, I18nService } from "nestjs-i18n";
import type { MoodCheckinDto, Paginated } from "@mentor/types";
import type { ListMoodCheckinsQuery } from "@mentor/validation";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { todayIso } from "../domain/date.util";
import { mapMood } from "../domain/mood";
import { CoachingEventTopic, MoodLow } from "../domain/coaching.events";
import { MoodCheckinRepository, type MoodCheckinRow } from "../infrastructure/mood-checkin.repository";
import { toMoodCheckinDto } from "./coaching.mappers";
import type { CoachMoodTrend } from "../domain/coach-evidence";

/**
 * Mood check-in (rule-based, NO AI — guardrail §4 #5). One per day (upsert). The encouraging
 * message is mapped from the 1..5 value (`domain/mood.ts`) and localized from the backend
 * (`coaching.mood.*`); the client renders `message` verbatim.
 */
@Injectable()
export class MoodService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly moods: MoodCheckinRepository,
    private readonly i18n: I18nService,
    private readonly events: EventEmitter2,
  ) {}

  async upsertToday(
    userId: string,
    mood: number,
    struggleNote?: string,
  ): Promise<MoodCheckinDto> {
    const today = todayIso();
    const trimmed = struggleNote?.trim();
    const note = trimmed ? trimmed : null;
    const row = await withUserContext(this.db, { userId }, async (tx) => {
      return this.moods.upsert(tx, userId, today, mood, note);
    });
    if (mood <= 2) {
      this.events.emit(CoachingEventTopic.MOOD_LOW, new MoodLow(userId, mood));
    }
    return this.toDto(row);
  }

  /**
   * Cache today's premium AI-adaptive reflection (written by W3 via the public service surface,
   * so the `mood_checkins` table is only ever mutated inside coaching — workstreams §2).
   */
  async setTodayAiReflection(
    userId: string,
    reflection: string,
    model: string,
    locale: string,
  ): Promise<void> {
    const today = todayIso();
    await withUserContext(this.db, { userId }, async (tx) => {
      await this.moods.setAiReflection(tx, userId, today, reflection, model, locale);
    });
  }

  async getTodayAiLocale(userId: string): Promise<string | null> {
    const today = todayIso();
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.moods.findByDate(tx, userId, today);
      return row?.aiLocale ?? null;
    });
  }

  async getToday(userId: string): Promise<MoodCheckinDto | null> {
    const today = todayIso();
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.moods.findByDate(tx, userId, today);
      return row ? this.toDto(row) : null;
    });
  }

  async getCoachMoodEvidence(userId: string): Promise<{
    today: number | null;
    trend: CoachMoodTrend;
    observedAt: Date;
  }> {
    const rows = await withUserContext(this.db, { userId }, (tx) =>
      this.moods.listRecentLevels(tx, userId, 5),
    );
    const today = rows.find((row) => row.checkinDate === todayIso())?.mood ?? null;
    if (rows.length < 2) {
      return { today, trend: "UNKNOWN", observedAt: new Date() };
    }
    const delta = rows[0]!.mood - rows[rows.length - 1]!.mood;
    const trend: CoachMoodTrend = delta > 0 ? "UP" : delta < 0 ? "DOWN" : "STABLE";
    return { today, trend, observedAt: new Date(`${rows[0]!.checkinDate}T12:00:00Z`) };
  }

  async list(userId: string, query: ListMoodCheckinsQuery): Promise<Paginated<MoodCheckinDto>> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const { items, total } = await this.moods.listPaged(tx, userId, query.page, query.pageSize);
      return {
        items: items.map((row) => this.toDto(row)),
        total,
        page: query.page,
        pageSize: query.pageSize,
      };
    });
  }

  /** Attach the rule-based, localized encouragement to a mood row. */
  private toDto(row: MoodCheckinRow): MoodCheckinDto {
    const { code, i18nKey } = mapMood(row.mood);
    const message = this.i18n.translate(i18nKey, {
      lang: I18nContext.current()?.lang,
    }) as unknown as string;
    return toMoodCheckinDto(row, code, message);
  }
}
