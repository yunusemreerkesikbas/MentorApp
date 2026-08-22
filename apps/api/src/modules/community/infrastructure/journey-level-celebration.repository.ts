import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { JourneyLevelCelebrationKind } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { userJourneyLevelCelebrations } from "../../../database/schema";
import { planJourneyLevelCelebrationSync } from "../domain/journey-level-celebration";

type StoredJourneyLevelCelebrationRow = typeof userJourneyLevelCelebrations.$inferSelect;
export type JourneyLevelCelebrationRow = Omit<StoredJourneyLevelCelebrationRow, "kind" | "resolution"> & {
  kind: JourneyLevelCelebrationKind;
  resolution: "SHOWN" | "SUPERSEDED" | null;
};

@Injectable()
export class JourneyLevelCelebrationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  synchronize(input: {
    userId: string;
    orgId: string | null;
    tier: number;
    observedAt: Date;
  }): Promise<JourneyLevelCelebrationRow | null> {
    return withServiceContext(this.db, async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`journey-level:${input.userId}`}, 0))`,
      );
      const rows = await tx
        .select()
        .from(userJourneyLevelCelebrations)
        .where(eq(userJourneyLevelCelebrations.userId, input.userId))
        .orderBy(asc(userJourneyLevelCelebrations.tier));
      const plan = planJourneyLevelCelebrationSync(
        rows.map((row) => ({
          id: row.id,
          tier: row.tier,
          kind: row.kind as JourneyLevelCelebrationKind,
          resolvedAt: row.resolvedAt,
        })),
        input.tier,
        input.observedAt,
      );
      if (!plan.insert) return null;

      if (plan.supersedeIds.length > 0) {
        await tx
          .update(userJourneyLevelCelebrations)
          .set({ resolvedAt: input.observedAt, resolution: "SUPERSEDED" })
          .where(
            and(
              inArray(userJourneyLevelCelebrations.id, plan.supersedeIds),
              isNull(userJourneyLevelCelebrations.resolvedAt),
            ),
          );
      }

      const inserted = await tx
        .insert(userJourneyLevelCelebrations)
        .values({
          userId: input.userId,
          orgId: input.orgId,
          tier: plan.insert.tier,
          kind: plan.insert.kind,
          unlockedAt: plan.insert.unlockedAt,
        })
        .onConflictDoNothing({
          target: [userJourneyLevelCelebrations.userId, userJourneyLevelCelebrations.tier],
        })
        .returning();
      return inserted[0] ? toRow(inserted[0]) : null;
    });
  }

  listUnresolved(userId: string): Promise<JourneyLevelCelebrationRow[]> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const rows = await tx
        .select()
        .from(userJourneyLevelCelebrations)
        .where(
          and(
            eq(userJourneyLevelCelebrations.userId, userId),
            isNull(userJourneyLevelCelebrations.resolvedAt),
          ),
        )
        .orderBy(asc(userJourneyLevelCelebrations.unlockedAt));
      return rows.map(toRow);
    });
  }

  async markShown(userId: string, celebrationId: string): Promise<void> {
    await withUserContext(this.db, { userId }, (tx) =>
      tx
        .update(userJourneyLevelCelebrations)
        .set({ resolvedAt: new Date(), resolution: "SHOWN" })
        .where(
          and(
            eq(userJourneyLevelCelebrations.id, celebrationId),
            eq(userJourneyLevelCelebrations.userId, userId),
            isNull(userJourneyLevelCelebrations.resolvedAt),
          ),
        ),
    );
  }
}

function toRow(row: StoredJourneyLevelCelebrationRow): JourneyLevelCelebrationRow {
  return {
    ...row,
    kind: row.kind as JourneyLevelCelebrationKind,
    resolution: row.resolution as "SHOWN" | "SUPERSEDED" | null,
  };
}
