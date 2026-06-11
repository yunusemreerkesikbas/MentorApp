import { Inject, Injectable } from "@nestjs/common";
import { I18nContext, I18nService } from "nestjs-i18n";
import type { MoodCheckinDto, Paginated } from "@mentor/types";
import type { ListMoodCheckinsQuery } from "@mentor/validation";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { todayIso } from "../domain/date.util";
import { mapMood } from "../domain/mood";
import { MoodCheckinRepository, type MoodCheckinRow } from "../infrastructure/mood-checkin.repository";
import { toMoodCheckinDto } from "./coaching.mappers";

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
  ) {}

  async upsertToday(userId: string, mood: number): Promise<MoodCheckinDto> {
    const today = todayIso();
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.moods.upsert(tx, userId, today, mood);
      return this.toDto(row);
    });
  }

  async getToday(userId: string): Promise<MoodCheckinDto | null> {
    const today = todayIso();
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.moods.findByDate(tx, userId, today);
      return row ? this.toDto(row) : null;
    });
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
