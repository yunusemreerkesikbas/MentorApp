import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { economyRewardReceipts, ledgerEntries } from "../../../database/schema";

@Injectable()
export class RewardReceiptRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  listUnseen(userId: string, page: number, pageSize: number) {
    return withUserContext(this.db, { userId }, async (tx) => {
      const where = and(eq(economyRewardReceipts.userId, userId), isNull(economyRewardReceipts.seenAt));
      const [count] = await tx.select({ total: sql<number>`count(*)::int` })
        .from(economyRewardReceipts).where(where);
      const rows = await tx.select({ entry: ledgerEntries }).from(economyRewardReceipts)
        .innerJoin(ledgerEntries, eq(ledgerEntries.id, economyRewardReceipts.ledgerId))
        .where(where).orderBy(asc(ledgerEntries.createdAt), asc(ledgerEntries.id))
        .limit(pageSize).offset((page - 1) * pageSize);
      return { items: rows.map((row) => row.entry), total: count!.total, page, pageSize };
    });
  }

  markSeen(userId: string, ledgerIds: string[]): Promise<void> {
    return withUserContext(this.db, { userId }, async (tx) => {
      await tx.update(economyRewardReceipts).set({ seenAt: new Date() }).where(and(
        eq(economyRewardReceipts.userId, userId),
        inArray(economyRewardReceipts.ledgerId, ledgerIds), isNull(economyRewardReceipts.seenAt),
      ));
    });
  }
}
