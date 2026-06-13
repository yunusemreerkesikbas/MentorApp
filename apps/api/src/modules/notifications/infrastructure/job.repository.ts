import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, lte, lt, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { jobs } from "../../../database/schema";
import { JobStatus } from "../domain/notifications.constants";

export type JobRow = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

/** Data access for the MVP `jobs` queue table (SERVICE context — no RLS on jobs). */
@Injectable()
export class JobRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async insert(
    data: Pick<NewJob, "name" | "payload" | "runAt" | "maxAttempts">,
  ): Promise<JobRow> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .insert(jobs)
        .values({
          name: data.name,
          payload: data.payload,
          runAt: data.runAt ?? new Date(),
          maxAttempts: data.maxAttempts ?? 5,
          status: JobStatus.PENDING,
        })
        .returning();
      return rows[0]!;
    });
  }

  /** Claim a batch of runnable jobs (SKIP LOCKED — safe for concurrent cron workers). */
  async claimBatch(tx: DatabaseTx, limit: number): Promise<JobRow[]> {
    const picked = await tx.execute<{ id: string }>(sql`
      SELECT id FROM jobs
      WHERE status = ${JobStatus.PENDING}
        AND run_at <= now()
        AND attempts < max_attempts
      ORDER BY run_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `);
    const ids = picked.rows.map((r) => r.id);
    if (ids.length === 0) return [];

    return tx
      .update(jobs)
      .set({
        status: JobStatus.RUNNING,
        attempts: sql<number>`${jobs.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(inArray(jobs.id, ids))
      .returning();
  }

  /** Force a job straight to DEAD (no retry) — for permanent failures like a missing handler. */
  async markDead(tx: DatabaseTx, id: string, error: string): Promise<void> {
    await tx
      .update(jobs)
      .set({ status: JobStatus.DEAD, lastError: error.slice(0, 2000), updatedAt: new Date() })
      .where(eq(jobs.id, id));
  }

  async markCompleted(tx: DatabaseTx, id: string): Promise<void> {
    await tx
      .update(jobs)
      .set({ status: JobStatus.COMPLETED, lastError: null, updatedAt: new Date() })
      .where(eq(jobs.id, id));
  }

  async markFailed(
    tx: DatabaseTx,
    row: JobRow,
    error: string,
  ): Promise<void> {
    const exhausted = row.attempts >= row.maxAttempts;
    if (!exhausted) {
      const delaySec = Math.min(3600, 60 * 2 ** (row.attempts - 1));
      const nextRunAt = new Date(Date.now() + delaySec * 1000);
      await tx
        .update(jobs)
        .set({
          status: JobStatus.PENDING,
          lastError: error.slice(0, 2000),
          runAt: nextRunAt,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, row.id));
      return;
    }
    await tx
      .update(jobs)
      .set({
        status: JobStatus.DEAD,
        lastError: error.slice(0, 2000),
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, row.id));
  }

  async findById(id: string): Promise<JobRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx.select().from(jobs).where(eq(jobs.id, id)).limit(1);
      return rows[0];
    });
  }

  /** Test/diagnostic helper — count pending runnable jobs. */
  async countRunnable(): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const result = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(jobs)
        .where(
          and(
            eq(jobs.status, JobStatus.PENDING),
            lte(jobs.runAt, new Date()),
            lt(jobs.attempts, jobs.maxAttempts),
          ),
        );
      return result[0]?.count ?? 0;
    });
  }
}
