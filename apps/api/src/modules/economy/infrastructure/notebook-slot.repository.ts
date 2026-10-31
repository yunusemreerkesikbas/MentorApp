import { Inject, Injectable } from "@nestjs/common";
import { and, eq, lt, sql } from "drizzle-orm";
import { Currency, LedgerStatus } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { ledgerEntries } from "../../../database/schema";
import { EconomyLedger } from "../domain/economy.constants";

/** Each confirmed debit is one permanent capacity slot, regardless of its historical price. */
@Injectable()
export class NotebookSlotRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  countPurchased(userId: string, exec?: DatabaseTx): Promise<number> {
    const read = async (tx: DatabaseTx) => {
      const [row] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.userId, userId),
            eq(ledgerEntries.unit, Currency.COIN),
            eq(ledgerEntries.status, LedgerStatus.CONFIRMED),
            eq(ledgerEntries.reason, EconomyLedger.NOTEBOOK_SLOT_SPEND_REASON),
            eq(ledgerEntries.refType, EconomyLedger.NOTEBOOK_SLOT_REF_TYPE),
            lt(ledgerEntries.amount, 0),
          ),
        );
      return row?.count ?? 0;
    };
    return exec ? read(exec) : withServiceContext(this.db, read);
  }
}
