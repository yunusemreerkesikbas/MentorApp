import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import type { JobHandler } from "../domain/job-handler";
import { INTERRUPTED_JOB_REASON, JobRepository, type JobRow } from "../infrastructure/job.repository";

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
  private recoveryAfterMs = 0;

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
    if (batchSize <= 0) return result;
    const timeoutSeconds = await this.config.get("notifications.jobs.running_timeout_seconds");
    const now = Date.now();
    if (now >= this.recoveryAfterMs) {
      const interrupted = await withServiceContext(this.db, (tx) => this.jobs.quarantineInterrupted(tx, batchSize, timeoutSeconds));
      // A full page may leave more abandoned jobs. Drain them on the next bounded batch.
      this.recoveryAfterMs = interrupted.length === batchSize ? 0 : now + timeoutSeconds * 1000;
      result.processed = result.dead = interrupted.length;
      for (const job of interrupted) this.captureDeadJob(job, INTERRUPTED_JOB_REASON);
    }

    while (result.processed < batchSize) {
      // Unstarted jobs must stay PENDING if this process disappears during a slow handler.
      const [job] = await withServiceContext(this.db, (tx) => this.jobs.claimBatch(tx, 1));
      if (!job) break;
      result.processed += 1;
      const outcome = await this.dispatchWithHeartbeat(job, timeoutSeconds);
      if (outcome === "completed") result.completed += 1;
      else if (outcome === "dead") result.dead += 1;
      else result.failed += 1;
    }

    return result;
  }

  private async dispatchWithHeartbeat(job: JobRow, timeoutSeconds: number) {
    let pending: Promise<unknown> | undefined;
    const timer = setInterval(() => {
      if (pending) return;
      pending = withServiceContext(this.db, (tx) => this.jobs.heartbeat(tx, job))
        .catch(() => this.logger.warn({ event: "job.heartbeat_failed", jobId: job.id, jobName: job.name }))
        .finally(() => { pending = undefined; });
    }, timeoutSeconds * 1000 / 3);
    timer.unref?.();
    try {
      return await this.dispatch(job);
    } finally {
      clearInterval(timer);
      await pending;
    }
  }

  private lostExecution(job: JobRow): "failed" {
    Sentry.captureException(new Error("Job result discarded: execution no longer owns the job."), {
      tags: { jobName: job.name, jobId: job.id },
    });
    return "failed";
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

  private async dispatch(job: JobRow): Promise<"completed" | "failed" | "dead"> {
    const handler = this.handlers.get(job.name);
    if (!handler) {
      // A missing handler is a permanent failure — retrying won't register one. Mark DEAD
      // directly so the result count matches the row state (markFailed would reschedule).
      this.logger.error(`No handler for job ${job.name} (${job.id})`);
      const updated = await withServiceContext(this.db, (tx) =>
        this.jobs.markDead(tx, job.id, `No handler registered for ${job.name}`, job.attempts));
      if (!updated) return this.lostExecution(job);
      this.captureDeadJob(job, `No handler registered for ${job.name}`);
      return "dead";
    }

    try {
      await handler(job.payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Job ${job.name} (${job.id}) failed: ${message}`);
      const exhausted = job.attempts >= job.maxAttempts;
      const updated = await withServiceContext(this.db, (tx) => this.jobs.markFailed(tx, job, message));
      if (!updated) return this.lostExecution(job);
      if (exhausted) this.captureDeadJob(job, message);
      return exhausted ? "dead" : "failed";
    }

    // The side effect succeeded. A lost DB acknowledgement must not turn it into a retry.
    try {
      const updated = await withServiceContext(this.db, (tx) => this.jobs.markCompleted(tx, job.id, job.attempts));
      if (!updated) return this.lostExecution(job);
      return "completed";
    } catch {
      throw new Error("Job completion could not be recorded; manual review required.");
    }
  }
}
