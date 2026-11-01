import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gt, gte, inArray, lt, or, sql } from "drizzle-orm";
import type { CoachPlanAdaptationDto } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { aiPlanPreviews } from "../../../database/schema-plan-previews";
import { PLAN_PREVIEW_LEASE_MS } from "../domain/plan-coin-preview";

export type PlanPreviewRow = typeof aiPlanPreviews.$inferSelect;

@Injectable()
export class PlanPreviewRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  withUserLock<T>(
    userId: string,
    run: (tx: DatabaseTx) => Promise<T>,
  ): Promise<T> {
    return withServiceContext(this.db, async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`ai-plan-preview:${userId}`}, 0))`,
      );
      await tx
        .update(aiPlanPreviews)
        .set({ status: "FAILED" })
        .where(
          and(
            eq(aiPlanPreviews.userId, userId),
            eq(aiPlanPreviews.status, "RUNNING"),
            lt(
              aiPlanPreviews.createdAt,
              new Date(Date.now() - PLAN_PREVIEW_LEASE_MS),
            ),
          ),
        );
      return run(tx);
    });
  }

  find(
    userId: string,
    requestId: string,
    exec?: DatabaseTx,
  ): Promise<PlanPreviewRow | undefined> {
    const read = async (tx: DatabaseTx) =>
      (
        await tx
          .select()
          .from(aiPlanPreviews)
          .where(
            and(
              eq(aiPlanPreviews.userId, userId),
              eq(aiPlanPreviews.clientRequestId, requestId),
            ),
          )
          .limit(1)
      )[0];
    return exec ? read(exec) : withServiceContext(this.db, read);
  }

  countSince(userId: string, since: Date, tx: DatabaseTx): Promise<number> {
    return tx
      .select({ n: sql<number>`count(*)::int` })
      .from(aiPlanPreviews)
      .where(
        and(
          eq(aiPlanPreviews.userId, userId),
          gte(aiPlanPreviews.createdAt, since),
          or(
            inArray(aiPlanPreviews.status, ["RUNNING", "GENERATED"]),
            and(eq(aiPlanPreviews.status, "READY"), gt(aiPlanPreviews.cost, 0)),
          ),
        ),
      )
      .then(([row]) => row?.n ?? 0);
  }

  async latest(
    userId: string,
    tx: DatabaseTx,
    includeGenerated = true,
  ): Promise<string | null> {
    const [row] = await tx
      .select({ id: aiPlanPreviews.clientRequestId })
      .from(aiPlanPreviews)
      .where(
        and(
          eq(aiPlanPreviews.userId, userId),
          inArray(
            aiPlanPreviews.status,
            includeGenerated ? ["GENERATED", "READY"] : ["READY"],
          ),
        ),
      )
      .orderBy(desc(aiPlanPreviews.createdAt))
      .limit(1);
    return row?.id ?? null;
  }

  async create(
    row: typeof aiPlanPreviews.$inferInsert,
    tx: DatabaseTx,
  ): Promise<void> {
    await tx.insert(aiPlanPreviews).values(row);
  }

  async set(
    userId: string,
    requestId: string,
    values: {
      status: PlanPreviewRow["status"];
      response?: CoachPlanAdaptationDto;
      cost?: number;
    },
    tx: DatabaseTx,
  ): Promise<void> {
    await tx
      .update(aiPlanPreviews)
      .set(values)
      .where(
        and(
          eq(aiPlanPreviews.userId, userId),
          eq(aiPlanPreviews.clientRequestId, requestId),
        ),
      );
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await withServiceContext(this.db, (tx) =>
      tx.delete(aiPlanPreviews).where(eq(aiPlanPreviews.userId, userId)),
    );
  }
}
