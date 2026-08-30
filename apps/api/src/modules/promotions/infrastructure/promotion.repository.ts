import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { promotions } from "../../../database/schema";

export type PromotionRow = typeof promotions.$inferSelect;
export type NewPromotion = typeof promotions.$inferInsert;

@Injectable()
export class PromotionRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private onService<T>(
    exec: DatabaseTx | undefined,
    fn: (tx: DatabaseTx) => Promise<T>,
  ): Promise<T> {
    return exec ? fn(exec) : withServiceContext(this.db, fn);
  }

  /** Active rows whose date window contains `now`. Rule/plan filtering happens in the service. */
  findLive(now: Date, exec?: DatabaseTx): Promise<PromotionRow[]> {
    return this.onService(exec, (tx) =>
      tx
        .select()
        .from(promotions)
        .where(
          and(
            eq(promotions.isActive, true),
            or(isNull(promotions.startsAt), sql`${promotions.startsAt} <= ${now}`),
            or(isNull(promotions.endsAt), sql`${promotions.endsAt} > ${now}`),
          ),
        ),
    );
  }

  /** Live rows that require a code — the "a coupon is waiting for you" candidates. */
  findLiveCoded(now: Date, exec?: DatabaseTx): Promise<PromotionRow[]> {
    return this.onService(exec, (tx) =>
      tx
        .select()
        .from(promotions)
        .where(
          and(
            eq(promotions.isActive, true),
            isNotNull(promotions.code),
            or(isNull(promotions.startsAt), sql`${promotions.startsAt} <= ${now}`),
            or(isNull(promotions.endsAt), sql`${promotions.endsAt} > ${now}`),
          ),
        ),
    );
  }

  /** Case-insensitive lookup — codes are stored upper-cased but users type them freely. */
  async findActiveByCode(code: string, exec?: DatabaseTx): Promise<PromotionRow | undefined> {
    return this.onService(exec, async (tx) => {
      const [row] = await tx
        .select()
        .from(promotions)
        .where(and(sql`lower(${promotions.code}) = lower(${code})`, eq(promotions.isActive, true)))
        .limit(1);
      return row;
    });
  }

  async findById(id: string, exec?: DatabaseTx): Promise<PromotionRow | undefined> {
    return this.onService(exec, async (tx) => {
      const [row] = await tx.select().from(promotions).where(eq(promotions.id, id)).limit(1);
      return row;
    });
  }

  /** Admin listing — newest first; the catalog stays small enough not to need pagination yet. */
  listAll(exec?: DatabaseTx): Promise<PromotionRow[]> {
    return this.onService(exec, (tx) =>
      tx.select().from(promotions).orderBy(desc(promotions.createdAt)),
    );
  }

  async create(entry: NewPromotion, exec?: DatabaseTx): Promise<PromotionRow> {
    return this.onService(exec, async (tx) => {
      const [row] = await tx.insert(promotions).values(entry).returning();
      if (!row) throw new Error("Promotion insert returned no row");
      return row;
    });
  }

  async update(
    id: string,
    patch: Partial<NewPromotion>,
    exec?: DatabaseTx,
  ): Promise<PromotionRow | undefined> {
    return this.onService(exec, async (tx) => {
      const [row] = await tx.update(promotions).set(patch).where(eq(promotions.id, id)).returning();
      return row;
    });
  }
}
