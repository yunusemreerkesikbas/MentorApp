import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, gt, inArray, ne, or, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { aiWeeklyRecaps as reports } from "../../../database/schema-weekly-recaps";

export type WeeklyRecapRow = typeof reports.$inferSelect;
export type NewWeeklyRecap = typeof reports.$inferInsert;

@Injectable()
export class WeeklyRecapRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  locked<T>(userId: string, run: (tx: DatabaseTx) => Promise<T>): Promise<T> {
    return withServiceContext(this.db, async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`weekly-recap:${userId}`},0))`);
      return run(tx);
    });
  }

  private on<T>(tx: DatabaseTx | undefined, run: (tx: DatabaseTx) => Promise<T>) {
    return tx ? run(tx) : withServiceContext(this.db, run);
  }

  find(userId: string, examId: string, weekStart: string, tx?: DatabaseTx) {
    return this.on(tx, async (db) => (await db.select().from(reports).where(and(
      eq(reports.userId, userId), eq(reports.examId, examId), eq(reports.weekStart, weekStart),
    )).limit(1))[0]);
  }

  byId(userId: string, id: string) {
    return this.on(undefined, async (db) => (await db.select().from(reports)
      .where(and(eq(reports.userId, userId), eq(reports.id, id))).limit(1))[0]);
  }

  byRequest(userId: string, requestId: string, tx: DatabaseTx) {
    return tx.select().from(reports).where(and(eq(reports.userId, userId),
      eq(reports.clientRequestId, requestId))).limit(1).then(([row]) => row);
  }

  async create(row: NewWeeklyRecap, tx: DatabaseTx) {
    return (await tx.insert(reports).values(row).returning())[0]!;
  }

  async update(row: WeeklyRecapRow, values: Partial<NewWeeklyRecap>, tx: DatabaseTx) {
    return (await tx.update(reports).set(values).where(and(eq(reports.userId, row.userId),
      eq(reports.id, row.id), eq(reports.claimId, row.claimId))).returning())[0];
  }

  async reservations(userId: string, tx: DatabaseTx, exceptId?: string) {
    return tx.select({ source: reports.source, expiresAt: reports.expiresAt, cost: reports.cost }).from(reports).where(and(
      eq(reports.userId, userId), inArray(reports.status, ["RUNNING", "GENERATED"]),
      gt(reports.expiresAt, new Date()), exceptId ? ne(reports.id, exceptId) : undefined,
    ));
  }

  async earnedCount(userId: string, tx: DatabaseTx) {
    const [row] = await tx.select({ n: count() }).from(reports).where(and(
      eq(reports.userId, userId), eq(reports.source, "EARNED"), eq(reports.status, "READY"),
    ));
    return row?.n ?? 0;
  }

  summaryCount(userId: string) {
    return this.on(undefined, async (tx) => (await tx.select({ n: count() }).from(reports).where(and(
      eq(reports.userId, userId), eq(reports.status, "READY"), ne(reports.source, "COIN"),
    )))[0]?.n ?? 0);
  }

  summaries(userId: string, take: number, coinIdentities?: { examId: string; weekStart: string }[]) {
    return this.on(undefined, (tx) => tx.select({ id: reports.id, examId: reports.examId,
      weekStart: reports.weekStart, locale: reports.locale, source: reports.source, openedAt: reports.openedAt,
      endDate: sql<string>`${reports.review}->'period'->>'endDate'`,
    }).from(reports).where(and(eq(reports.userId, userId), eq(reports.status, "READY"),
      coinIdentities ? and(eq(reports.source, "COIN"), or(...coinIdentities.map((identity) =>
        and(eq(reports.examId, identity.examId), eq(reports.weekStart, identity.weekStart))))) : ne(reports.source, "COIN"),
    )).orderBy(desc(reports.openedAt), desc(reports.id)).limit(take));
  }

  async erase(userId: string) {
    await this.on(undefined, (tx) => tx.delete(reports).where(eq(reports.userId, userId)));
  }
}
