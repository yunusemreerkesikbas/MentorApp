import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { jobs } from "../../../database/schema";
import type { JobHandler } from "../domain/job-handler";
import { JobRepository, type JobRow } from "../infrastructure/job.repository";

export interface ProcessJobsResult {
  processed: number;
  completed: number;
  failed: number;
  dead: number;
}

/**
 * Polls the `jobs` table and dispatches to registered handlers.
 * Render Cron hits the HTTP endpoint — no continuous polling (scale-to-zero safe).
 */
@Injectable()
export class JobRunnerService {
  private readonly logger = new Logger(JobRunnerService.name);
  private readonly handlers = new Map<string, JobHandler>();

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly jobs: JobRepository,
  ) {}

  /** Extension point for W3/W6 — register additional job handlers at module init. */
  registerHandler(name: string, handler: JobHandler): void {
    if (this.handlers.has(name)) {
      this.logger.warn(`Overwriting job handler: ${name}`);
    }
    this.handlers.set(name, handler);
  }

  async processBatch(batchSize = 25): Promise<ProcessJobsResult> {
    const result: ProcessJobsResult = { processed: 0, completed: 0, failed: 0, dead: 0 };

    const claimed = await withServiceContext(this.db, async (tx) => this.jobs.claimBatch(tx, batchSize));
    result.processed = claimed.length;

    for (const job of claimed) {
      const outcome = await this.dispatch(job);
      if (outcome === "completed") result.completed += 1;
      else if (outcome === "dead") result.dead += 1;
      else result.failed += 1;
    }

    return result;
  }

  private async dispatch(job: JobRow): Promise<"completed" | "retry" | "dead"> {
    const handler = this.handlers.get(job.name);
    if (!handler) {
      this.logger.error(`No handler for job ${job.name} (${job.id})`);
      await withServiceContext(this.db, async (tx) => {
        await this.jobs.markFailed(tx, job, `No handler registered for ${job.name}`);
      });
      return "dead";
    }

    try {
      await handler(job.payload);
      await withServiceContext(this.db, async (tx) => {
        await this.jobs.markCompleted(tx, job.id);
      });
      return "completed";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Job ${job.name} (${job.id}) failed: ${message}`);
      let outcome: "retry" | "dead" = "retry";
      await withServiceContext(this.db, async (tx) => {
        const rows = await tx.select().from(jobs).where(eq(jobs.id, job.id)).limit(1);
        const current = rows[0] ?? job;
        const exhausted = current.attempts >= current.maxAttempts;
        await this.jobs.markFailed(tx, current, message);
        outcome = exhausted ? "dead" : "retry";
      });
      return outcome;
    }
  }
}
