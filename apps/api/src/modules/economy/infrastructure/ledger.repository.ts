import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { Currency, LedgerStatus } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { ledgerEntries } from "../../../database/schema";

export type LedgerRow = typeof ledgerEntries.$inferSelect;
export type NewLedgerEntry = typeof ledgerEntries.$inferInsert;

export interface Balance {
  xp: number;
  coinConfirmed: number;
  coinPending: number;
}

/**
 * Append-only ledger access (§4 #3). Writes/aggregations for the system/admin run in SERVICE
 * context; a user's own reads run in user context (RLS self-read belt). Balance = sum of rows.
 */
@Injectable()
export class LedgerRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Append one immutable entry. Idempotent on (refType,refId): a duplicate is a no-op. */
  async append(entry: NewLedgerEntry): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.insert(ledgerEntries).values(entry).onConflictDoNothing();
    });
  }

  private async aggregate(userId: string, scope: "self" | "service"): Promise<Balance> {
    const compute = async (tx: DatabaseTx): Promise<Balance> => {
      const rows = await tx
        .select({
          unit: ledgerEntries.unit,
          status: ledgerEntries.status,
          total: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)::int`,
        })
        .from(ledgerEntries)
        .where(eq(ledgerEntries.userId, userId))
        .groupBy(ledgerEntries.unit, ledgerEntries.status);

      const balance: Balance = { xp: 0, coinConfirmed: 0, coinPending: 0 };
      for (const r of rows) {
        if (r.unit === Currency.XP) balance.xp += r.total;
        else if (r.unit === Currency.COIN) {
          if (r.status === LedgerStatus.CONFIRMED) balance.coinConfirmed += r.total;
          else if (r.status === LedgerStatus.PENDING) balance.coinPending += r.total;
        }
      }
      return balance;
    };
    return scope === "self"
      ? withUserContext(this.db, { userId }, compute)
      : withServiceContext(this.db, compute);
  }

  balanceSelf(userId: string): Promise<Balance> {
    return this.aggregate(userId, "self");
  }
  balanceService(userId: string): Promise<Balance> {
    return this.aggregate(userId, "service");
  }

  /** Sum of positive COIN grants since `since` (for daily/weekly earning caps). */
  async coinEarnedSince(userId: string, since: Date): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({
          total: sql<number>`coalesce(sum(${ledgerEntries.amount}) filter (where ${ledgerEntries.amount} > 0), 0)::int`,
        })
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.userId, userId),
            eq(ledgerEntries.unit, Currency.COIN),
            gte(ledgerEntries.createdAt, since),
          ),
        );
      return rows[0]?.total ?? 0;
    });
  }

  listSelf(userId: string, page: number, pageSize: number): Promise<LedgerRow[]> {
    return withUserContext(this.db, { userId }, (tx) =>
      tx
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.userId, userId))
        .orderBy(desc(ledgerEntries.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    );
  }

  listService(userId: string, limit: number): Promise<LedgerRow[]> {
    return withServiceContext(this.db, (tx) =>
      tx
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.userId, userId))
        .orderBy(desc(ledgerEntries.createdAt))
        .limit(limit),
    );
  }
}
