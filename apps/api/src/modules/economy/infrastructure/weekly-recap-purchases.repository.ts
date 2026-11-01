import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, gte, lt } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { ledgerEntries } from "../../../database/schema";
import { EconomyLedger } from "../domain/economy.constants";

const purchaseWhere = (userId: string) => and(eq(ledgerEntries.userId, userId),
  eq(ledgerEntries.refType, EconomyLedger.DEEP_ANALYSIS_REF_TYPE), eq(ledgerEntries.unit, "COIN"),
  eq(ledgerEntries.status, "CONFIRMED"), lt(ledgerEntries.amount, 0));

@Injectable()
export class WeeklyRecapPurchasesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  total(userId: string) {
    return withServiceContext(this.db, async (tx) => (await tx.select({ n: count() })
      .from(ledgerEntries).where(purchaseWhere(userId)))[0]?.n ?? 0);
  }

  page(userId: string, take: number) {
    return withServiceContext(this.db, (tx) => tx.select({ id: ledgerEntries.id, at: ledgerEntries.createdAt, refId: ledgerEntries.refId })
      .from(ledgerEntries).where(purchaseWhere(userId)).orderBy(desc(ledgerEntries.createdAt), desc(ledgerEntries.id)).limit(take));
  }

  history(userId: string, since: Date, tx?: DatabaseTx) {
    const read = (db: DatabaseTx) => db.select({ id: ledgerEntries.id, at: ledgerEntries.createdAt, refId: ledgerEntries.refId })
      .from(ledgerEntries).where(and(
        purchaseWhere(userId), gte(ledgerEntries.createdAt, since),
      )).orderBy(desc(ledgerEntries.createdAt));
    return tx ? read(tx) : withServiceContext(this.db, read);
  }
}
