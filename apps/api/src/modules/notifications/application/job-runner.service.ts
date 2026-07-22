import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { eq } from "drizzle-orm";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
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
 * API instances also poll periodically so user-triggered email jobs are delivered automatically.
 */
@Injectable()
export class JobRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobRunnerService.name);
  private readonly handlers = new Map<string, JobHandler>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private polling = false;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly jobs: JobRepository,
    private readonly config: ConfigRegistryService,
  ) {}

  async onModuleInit(): Promise<void> {
    const intervalSeconds = await this.config.get("notifications.jobs.poll_interval_seconds");
    this.pollTimer = setInterval(
      () => void this.processDueJobs(),
      intervalSeconds * 1000,
    );
    this.pollTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  /**
   * A DEAD job is a permanently lost side-effect (verification mail, payment welcome, push) —
   * surface it in Sentry so someone notices. Tags only name/id; the payload stays out (PII).
   */
  private captureDeadJob(job: JobRow, reason: string): void {
    Sentry.captureException(new Error(`Job dead: ${job.name} — ${reason}`), {
      tags: { jobName: job.name, jobId: job.id },
    });
  }

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

  private async processDueJobs(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const result = await this.processBatch();
      if (result.processed > 0) {
        this.logger.log(
          `Processed jobs: ${result.completed} completed, ${result.failed} retry, ${result.dead} dead`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Job polling failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.polling = false;
    }
  }

  private async dispatch(job: JobRow): Promise<"completed" | "retry" | "dead"> {
    const handler = this.handlers.get(job.name);
    if (!handler) {
      // A missing handler is a permanent failure — retrying won't register one. Mark DEAD
      // directly so the result count matches the row state (markFailed would reschedule).
      this.logger.error(`No handler for job ${job.name} (${job.id})`);
      this.captureDeadJob(job, `No handler registered for ${job.name}`);
      await withServiceContext(this.db, async (tx) => {
        await this.jobs.markDead(tx, job.id, `No handler registered for ${job.name}`);
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
      let exhausted = false;
      await withServiceContext(this.db, async (tx) => {
        const rows = await tx.select().from(jobs).where(eq(jobs.id, job.id)).limit(1);
        const current = rows[0] ?? job;
        exhausted = current.attempts >= current.maxAttempts;
        await this.jobs.markFailed(tx, current, message);
      });
      if (exhausted) this.captureDeadJob(job, message);
      return exhausted ? "dead" : "retry";
    }
  }
}
