import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, gt, gte, lte, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { adRewardSessions } from "../../../database/schema";

export type AdRewardSessionRow = typeof adRewardSessions.$inferSelect;
export type NewAdRewardSession = typeof adRewardSessions.$inferInsert;

@Injectable()
export class AdRewardSessionRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  withServiceTx<T>(fn: (tx: DatabaseTx) => Promise<T>): Promise<T> {
    return withServiceContext(this.db, fn);
  }

  private onService<T>(exec: DatabaseTx | undefined, fn: (tx: DatabaseTx) => Promise<T>): Promise<T> {
    return exec ? fn(exec) : withServiceContext(this.db, fn);
  }

  async acquireUserLock(userId: string, tx: DatabaseTx): Promise<void> {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"ads:" + userId}, 0))`);
  }

  async create(entry: NewAdRewardSession, tx: DatabaseTx): Promise<AdRewardSessionRow> {
    const [row] = await tx.insert(adRewardSessions).values(entry).returning();
    if (!row) throw new Error("Ad reward session insert returned no row");
    return row;
  }

  async findOwned(id: string, userId: string, exec?: DatabaseTx): Promise<AdRewardSessionRow | undefined> {
    return this.onService(exec, async (tx) => {
      const [row] = await tx
        .select()
        .from(adRewardSessions)
        .where(and(eq(adRewardSessions.id, id), eq(adRewardSessions.userId, userId)))
        .limit(1);
      return row;
    });
  }

  async findByIdempotencyKey(userId: string, idempotencyKey: string, exec?: DatabaseTx) {
    return this.onService(exec, async (tx) => {
      const [row] = await tx
        .select()
        .from(adRewardSessions)
        .where(
          and(
            eq(adRewardSessions.userId, userId),
            eq(adRewardSessions.idempotencyKey, idempotencyKey),
          ),
        )
        .limit(1);
      return row;
    });
  }

  async findActive(userId: string, placementId: string, now: Date, exec?: DatabaseTx) {
    return this.onService(exec, async (tx) => {
      const [row] = await tx
        .select()
        .from(adRewardSessions)
        .where(
          and(
            eq(adRewardSessions.userId, userId),
            eq(adRewardSessions.placementId, placementId),
            eq(adRewardSessions.status, "CREATED"),
            gt(adRewardSessions.expiresAt, now),
          ),
        )
        .limit(1);
      return row;
    });
  }

  listExpiredCreated(userId: string, now: Date, exec?: DatabaseTx) {
    return this.onService(exec, (tx) =>
      tx
        .select()
        .from(adRewardSessions)
        .where(
          and(
            eq(adRewardSessions.userId, userId),
            eq(adRewardSessions.status, "CREATED"),
            lte(adRewardSessions.expiresAt, now),
          ),
        ),
    );
  }

  listExpiredCandidates(now: Date, limit: number) {
    return this.onService(undefined, (tx) =>
      tx
        .select({ userId: adRewardSessions.userId })
        .from(adRewardSessions)
        .where(
          and(
            eq(adRewardSessions.status, "CREATED"),
            lte(adRewardSessions.expiresAt, now),
          ),
        )
        .orderBy(asc(adRewardSessions.expiresAt), asc(adRewardSessions.userId))
        .limit(limit),
    );
  }

  lockExpiredForUser(userId: string, now: Date, limit: number, tx: DatabaseTx) {
    return tx
      .select()
      .from(adRewardSessions)
      .where(
        and(
          eq(adRewardSessions.userId, userId),
          eq(adRewardSessions.status, "CREATED"),
          lte(adRewardSessions.expiresAt, now),
        ),
      )
      .orderBy(asc(adRewardSessions.expiresAt), asc(adRewardSessions.id))
      .limit(limit)
      .for("update", { skipLocked: true });
  }

  async rewardedCountSince(userId: string, placementId: string, since: Date, exec?: DatabaseTx) {
    return this.onService(exec, async (tx) => {
      const [row] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(adRewardSessions)
        .where(
          and(
            eq(adRewardSessions.userId, userId),
            eq(adRewardSessions.placementId, placementId),
            eq(adRewardSessions.status, "REWARDED"),
            gte(adRewardSessions.rewardedAt, since),
          ),
        );
      return row?.count ?? 0;
    });
  }

  async latestRewarded(userId: string, placementId: string, exec?: DatabaseTx) {
    return this.onService(exec, async (tx) => {
      const [row] = await tx
        .select()
        .from(adRewardSessions)
        .where(
          and(
            eq(adRewardSessions.userId, userId),
            eq(adRewardSessions.placementId, placementId),
            eq(adRewardSessions.status, "REWARDED"),
          ),
        )
        .orderBy(desc(adRewardSessions.rewardedAt))
        .limit(1);
      return row;
    });
  }

  async setStatus(
    id: string,
    from: "CREATED",
    status: "REWARDED" | "CLOSED" | "EXPIRED" | "REJECTED",
    tx: DatabaseTx,
    rejectionCode?: string,
  ): Promise<boolean> {
    const now = new Date();
    const rows = await tx
      .update(adRewardSessions)
      .set({
        status,
        rewardedAt: status === "REWARDED" ? now : undefined,
        rejectionCode: rejectionCode ?? undefined,
        updatedAt: now,
      })
      .where(and(eq(adRewardSessions.id, id), eq(adRewardSessions.status, from)))
      .returning({ id: adRewardSessions.id });
    return rows.length > 0;
  }

  async stats() {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({
          status: adRewardSessions.status,
          sessions: sql<number>`count(*)::int`,
          users: sql<number>`count(distinct ${adRewardSessions.userId})::int`,
          coin: sql<number>`coalesce(sum(${adRewardSessions.rewardCoin}) filter (where ${adRewardSessions.status} = 'REWARDED'), 0)::int`,
        })
        .from(adRewardSessions)
        .groupBy(adRewardSessions.status);
      const [total] = await tx
        .select({
          sessions: sql<number>`count(*)::int`,
          uniqueUsers: sql<number>`count(distinct ${adRewardSessions.userId})::int`,
        })
        .from(adRewardSessions);
      return { rows, sessions: total?.sessions ?? 0, uniqueUsers: total?.uniqueUsers ?? 0 };
    });
  }

  eraseForUser(userId: string, tx: DatabaseTx): Promise<void> {
    return tx.delete(adRewardSessions).where(eq(adRewardSessions.userId, userId)).then(() => undefined);
  }
}
