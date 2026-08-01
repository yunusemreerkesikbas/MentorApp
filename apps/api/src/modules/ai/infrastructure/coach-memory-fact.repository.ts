import { Inject, Injectable } from "@nestjs/common";
import {
  CoachMemoryFactSource,
  type CoachMemoryFactDto,
  type CoachMemoryFactKey,
  type Paginated,
} from "@mentor/types";
import { and, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { coachMemoryFacts } from "../../../database/schema";

type FactRow = typeof coachMemoryFacts.$inferSelect;

const toDto = (row: FactRow): CoachMemoryFactDto => ({
  id: row.id,
  key: row.key as CoachMemoryFactDto["key"],
  value: row.value,
  source: row.source as CoachMemoryFactDto["source"],
  expiresAt: row.expiresAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

@Injectable()
export class CoachMemoryFactRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  listPaged(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<Paginated<CoachMemoryFactDto>> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const now = new Date();
      const where = and(
        eq(coachMemoryFacts.userId, userId),
        or(
          isNull(coachMemoryFacts.expiresAt),
          gt(coachMemoryFacts.expiresAt, now),
        ),
      );
      const [rows, totals] = await Promise.all([
        tx
          .select()
          .from(coachMemoryFacts)
          .where(where)
          .orderBy(desc(coachMemoryFacts.updatedAt), desc(coachMemoryFacts.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        tx
          .select({ count: sql<number>`count(*)::int` })
          .from(coachMemoryFacts)
          .where(where),
      ]);
      return {
        items: rows.map(toDto),
        total: totals[0]?.count ?? 0,
        page,
        pageSize,
      };
    });
  }

  listActive(userId: string, now: Date): Promise<CoachMemoryFactDto[]> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const rows = await tx
        .select()
        .from(coachMemoryFacts)
        .where(
          and(
            eq(coachMemoryFacts.userId, userId),
            or(
              isNull(coachMemoryFacts.expiresAt),
              gt(coachMemoryFacts.expiresAt, now),
            ),
          ),
        )
        .orderBy(desc(coachMemoryFacts.updatedAt))
        .limit(20);
      return rows.map(toDto);
    });
  }

  getById(userId: string, id: string): Promise<CoachMemoryFactDto | null> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const [row] = await tx
        .select()
        .from(coachMemoryFacts)
        .where(
          and(eq(coachMemoryFacts.id, id), eq(coachMemoryFacts.userId, userId)),
        )
        .limit(1);
      return row ? toDto(row) : null;
    });
  }

  upsertChatFact(
    userId: string,
    sourceMessageId: string,
    fact: { key: CoachMemoryFactKey; value: string; expiresAt: Date | null },
  ): Promise<void> {
    return withUserContext(this.db, { userId }, async (tx) => {
      await tx
        .insert(coachMemoryFacts)
        .values({
          userId,
          key: fact.key,
          value: fact.value,
          source: CoachMemoryFactSource.CHAT,
          sourceMessageId,
          expiresAt: fact.expiresAt,
        })
        .onConflictDoUpdate({
          target: [coachMemoryFacts.userId, coachMemoryFacts.key],
          set: {
            value: fact.value,
            source: CoachMemoryFactSource.CHAT,
            sourceMessageId,
            expiresAt: fact.expiresAt,
            updatedAt: new Date(),
          },
        });
    });
  }

  updateByUser(
    userId: string,
    id: string,
    value: string,
    expiresAt: Date | null,
  ): Promise<CoachMemoryFactDto | null> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const [row] = await tx
        .update(coachMemoryFacts)
        .set({
          value,
          source: CoachMemoryFactSource.USER_EDIT,
          sourceMessageId: null,
          expiresAt,
          updatedAt: new Date(),
        })
        .where(
          and(eq(coachMemoryFacts.id, id), eq(coachMemoryFacts.userId, userId)),
        )
        .returning();
      return row ? toDto(row) : null;
    });
  }

  deleteByUser(userId: string, id: string): Promise<boolean> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const rows = await tx
        .delete(coachMemoryFacts)
        .where(
          and(eq(coachMemoryFacts.id, id), eq(coachMemoryFacts.userId, userId)),
        )
        .returning({ id: coachMemoryFacts.id });
      return rows.length > 0;
    });
  }

  clear(userId: string): Promise<void> {
    return withUserContext(this.db, { userId }, async (tx) => {
      await tx
        .delete(coachMemoryFacts)
        .where(eq(coachMemoryFacts.userId, userId));
    });
  }

  /** Idempotent maintenance path; service context is never exposed through an endpoint. */
  deleteExpired(now: Date): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .delete(coachMemoryFacts)
        .where(lt(coachMemoryFacts.expiresAt, now))
        .returning({ id: coachMemoryFacts.id });
      return rows.length;
    });
  }
}
