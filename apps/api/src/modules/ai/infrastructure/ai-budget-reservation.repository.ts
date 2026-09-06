import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { eq, gt, gte, lte, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { aiUsage } from "../../../database/schema";
import { aiBudgetReservations } from "../../../database/schema-ai-budget";

interface ReserveInput {
  capMicros: number;
  amountMicros: number;
  windowStart: Date;
  expiresAt: Date;
}

export function aiBudgetLockName(windowStart: Date): string {
  return `ai-budget:${windowStart.toISOString().slice(0, 7)}`;
}

/** Serializes the small reserve/check/insert critical section across every API instance. */
@Injectable()
export class AiBudgetReservationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async reserveIfAvailable(input: ReserveInput): Promise<string | null> {
    return withServiceContext(this.db, async (tx) => {
      const now = new Date();
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${aiBudgetLockName(input.windowStart)}, 0))`,
      );
      await tx.delete(aiBudgetReservations).where(lte(aiBudgetReservations.expiresAt, now));

      const [usageRow] = await tx
        .select({
          total: sql<number>`coalesce(sum(${aiUsage.costMicros}), 0)`.mapWith(Number),
        })
        .from(aiUsage)
        .where(gte(aiUsage.createdAt, input.windowStart));
      const [reservationRow] = await tx
        .select({
          total: sql<number>`coalesce(sum(${aiBudgetReservations.amountMicros}), 0)`.mapWith(Number),
        })
        .from(aiBudgetReservations)
        .where(gt(aiBudgetReservations.expiresAt, now));
      const committed = usageRow?.total ?? 0;
      const reserved = reservationRow?.total ?? 0;
      if (committed + reserved + input.amountMicros > input.capMicros) return null;

      const id = randomUUID();
      await tx.insert(aiBudgetReservations).values({
        id,
        amountMicros: input.amountMicros,
        expiresAt: input.expiresAt,
      });
      return id;
    });
  }

  async release(id: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.delete(aiBudgetReservations).where(eq(aiBudgetReservations.id, id));
    });
  }
}
