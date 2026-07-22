import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { aiDailyGreetings } from "../../../database/schema";

@Injectable()
export class DailyGreetingRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async find(userId: string, greetingDate: string, locale: string) {
    return withUserContext(this.db, { userId }, async (tx) => {
      const rows = await tx
        .select()
        .from(aiDailyGreetings)
        .where(
          and(
            eq(aiDailyGreetings.userId, userId),
            eq(aiDailyGreetings.greetingDate, greetingDate),
            eq(aiDailyGreetings.locale, locale),
          ),
        )
        .limit(1);
      return rows[0];
    });
  }

  /** One row per (user, day, locale); the unique index keeps each localized greeting stable. */
  async insert(data: {
    userId: string;
    greetingDate: string;
    greeting: string;
    model: string;
    locale: string;
  }): Promise<void> {
    await withUserContext(this.db, { userId: data.userId }, async (tx) => {
      await tx.insert(aiDailyGreetings).values(data).onConflictDoNothing();
    });
  }

  /** KVKK erasure: drop all cached greetings (AI-generated text about the user). Idempotent. */
  async deleteAllForUser(userId: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.delete(aiDailyGreetings).where(eq(aiDailyGreetings.userId, userId));
    });
  }
}
