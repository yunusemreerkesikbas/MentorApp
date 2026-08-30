import { Inject, Injectable } from "@nestjs/common";
import { and, count, eq, gt, ne, sql } from "drizzle-orm";
import { PromotionRedemptionStatus } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { promotionRedemptions } from "../../../database/schema";

export type PromotionRedemptionRow = typeof promotionRedemptions.$inferSelect;
export type NewPromotionRedemption = typeof promotionRedemptions.$inferInsert;

@Injectable()
export class PromotionRedemptionRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private onService<T>(
    exec: DatabaseTx | undefined,
    fn: (tx: DatabaseTx) => Promise<T>,
  ): Promise<T> {
    return exec ? fn(exec) : withServiceContext(this.db, fn);
  }

  /**
   * Serialize one user's redemptions so two concurrent checkouts cannot both pass the per-user
   * quota check. Namespaced separately from the ads lock — they guard unrelated invariants.
   */
  async acquireUserLock(userId: string, tx: DatabaseTx): Promise<void> {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"promotions:" + userId}, 0))`,
    );
  }

  /**
   * Serialize the GLOBAL cap for one promotion. The per-user lock is not enough: two DIFFERENT
   * users redeeming the last seat would each see `count - 1` and both commit.
   */
  async acquirePromotionLock(promotionId: string, tx: DatabaseTx): Promise<void> {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"promotion:" + promotionId}, 0))`,
    );
  }

  /** VOIDED rows release their seat, so they are excluded from every quota count. */
  async countForPromotion(promotionId: string, exec?: DatabaseTx): Promise<number> {
    return this.onService(exec, async (tx) => {
      const [row] = await tx
        .select({ value: count() })
        .from(promotionRedemptions)
        .where(
          and(
            eq(promotionRedemptions.promotionId, promotionId),
            ne(promotionRedemptions.status, PromotionRedemptionStatus.VOIDED),
          ),
        );
      return row?.value ?? 0;
    });
  }

  /** Redemption count per promotion in one scan — the admin list would otherwise be an N+1. */
  async countsByPromotion(exec?: DatabaseTx): Promise<Map<string, number>> {
    return this.onService(exec, async (tx) => {
      const rows = await tx
        .select({ promotionId: promotionRedemptions.promotionId, value: count() })
        .from(promotionRedemptions)
        .where(ne(promotionRedemptions.status, PromotionRedemptionStatus.VOIDED))
        .groupBy(promotionRedemptions.promotionId);
      return new Map(rows.map((row) => [row.promotionId, row.value]));
    });
  }

  async countForUser(promotionId: string, userId: string, exec?: DatabaseTx): Promise<number> {
    return this.onService(exec, async (tx) => {
      const [row] = await tx
        .select({ value: count() })
        .from(promotionRedemptions)
        .where(
          and(
            eq(promotionRedemptions.promotionId, promotionId),
            eq(promotionRedemptions.userId, userId),
            ne(promotionRedemptions.status, PromotionRedemptionStatus.VOIDED),
          ),
        );
      return row?.value ?? 0;
    });
  }

  async create(entry: NewPromotionRedemption, tx: DatabaseTx): Promise<PromotionRedemptionRow> {
    const [row] = await tx.insert(promotionRedemptions).values(entry).returning();
    if (!row) throw new Error("Promotion redemption insert returned no row");
    return row;
  }

  /** The live discount for a subscription: not voided, and with periods left to cover. */
  async findActiveForSubscription(
    subscriptionId: string,
    exec?: DatabaseTx,
  ): Promise<PromotionRedemptionRow | undefined> {
    return this.onService(exec, async (tx) => {
      const [row] = await tx
        .select()
        .from(promotionRedemptions)
        .where(
          and(
            eq(promotionRedemptions.subscriptionId, subscriptionId),
            ne(promotionRedemptions.status, PromotionRedemptionStatus.VOIDED),
            gt(promotionRedemptions.periodsRemaining, 0),
          ),
        )
        .limit(1);
      return row;
    });
  }

  /** Any non-voided row for a subscription, including one whose discount has run out. */
  async findForSubscription(
    subscriptionId: string,
    exec?: DatabaseTx,
  ): Promise<PromotionRedemptionRow | undefined> {
    return this.onService(exec, async (tx) => {
      const [row] = await tx
        .select()
        .from(promotionRedemptions)
        .where(
          and(
            eq(promotionRedemptions.subscriptionId, subscriptionId),
            ne(promotionRedemptions.status, PromotionRedemptionStatus.VOIDED),
          ),
        )
        .limit(1);
      return row;
    });
  }

  /** Compare-and-set: returns false when the row had already moved on (replayed webhook). */
  async setStatus(id: string, from: string, to: string, tx: DatabaseTx): Promise<boolean> {
    const rows = await tx
      .update(promotionRedemptions)
      .set({ status: to, updatedAt: new Date() })
      .where(and(eq(promotionRedemptions.id, id), eq(promotionRedemptions.status, from)))
      .returning({ id: promotionRedemptions.id });
    return rows.length > 0;
  }

  /** Consume one covered charge. Guarded so a replayed webhook cannot double-decrement. */
  async consumePeriod(id: string, tx: DatabaseTx): Promise<number | null> {
    const rows = await tx
      .update(promotionRedemptions)
      .set({
        periodsRemaining: sql`${promotionRedemptions.periodsRemaining} - 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(promotionRedemptions.id, id), gt(promotionRedemptions.periodsRemaining, 0)))
      .returning({ periodsRemaining: promotionRedemptions.periodsRemaining });
    return rows[0]?.periodsRemaining ?? null;
  }

  /** Release the seat held by an abandoned checkout. */
  async voidForSubscription(subscriptionId: string, exec?: DatabaseTx): Promise<void> {
    await this.onService(exec, async (tx) => {
      await tx
        .update(promotionRedemptions)
        .set({ status: PromotionRedemptionStatus.VOIDED, updatedAt: new Date() })
        .where(
          and(
            eq(promotionRedemptions.subscriptionId, subscriptionId),
            ne(promotionRedemptions.status, PromotionRedemptionStatus.VOIDED),
          ),
        );
    });
  }
}
