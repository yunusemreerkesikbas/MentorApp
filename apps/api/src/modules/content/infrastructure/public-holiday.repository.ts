import { Injectable } from "@nestjs/common";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { publicHolidays } from "../../../database/schema";

export type PublicHolidayRow = typeof publicHolidays.$inferSelect;
export type NewPublicHoliday = typeof publicHolidays.$inferInsert;

/** Editorial reference data — public, read-only for the app; writes come from the seed. */
@Injectable()
export class PublicHolidayRepository {
  /** Inclusive range, chronological. Bounded by the caller's 62-day query cap. */
  listInRange(
    db: DatabaseTx,
    country: string,
    from: string,
    to: string,
  ): Promise<PublicHolidayRow[]> {
    return db
      .select()
      .from(publicHolidays)
      .where(
        and(
          eq(publicHolidays.country, country),
          gte(publicHolidays.holidayDate, from),
          lte(publicHolidays.holidayDate, to),
        ),
      )
      .orderBy(asc(publicHolidays.holidayDate));
  }

  async upsertByCountryAndDate(
    tx: DatabaseTx,
    data: NewPublicHoliday,
  ): Promise<PublicHolidayRow> {
    const rows = await tx
      .insert(publicHolidays)
      .values(data)
      .onConflictDoUpdate({
        target: [publicHolidays.country, publicHolidays.holidayDate],
        set: {
          name: data.name,
          kind: data.kind,
          source: data.source,
          sourceUrl: data.sourceUrl,
          verifiedAt: data.verifiedAt,
          verifiedBy: data.verifiedBy,
          updatedAt: new Date(),
        },
      })
      .returning();
    return rows[0]!;
  }
}
