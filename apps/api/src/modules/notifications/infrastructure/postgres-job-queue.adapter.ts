import { Inject, Injectable } from "@nestjs/common";
import type { EnqueueOptions, JobQueuePort } from "../../../shared/ports/job-queue.port";
import { JOB_QUEUE_PORT } from "../../../shared/ports/job-queue.port";
import { JobRepository } from "./job.repository";

/** Postgres `jobs` table adapter for {@link JobQueuePort}. */
@Injectable()
export class PostgresJobQueueAdapter implements JobQueuePort {
  constructor(private readonly jobs: JobRepository) {}

  async enqueue<T>(
    name: string,
    payload: T,
    options?: EnqueueOptions,
  ): Promise<{ jobId: string }> {
    const row = await this.jobs.insert({
      name,
      payload: payload as Record<string, unknown>,
      runAt: options?.runAt,
      maxAttempts: options?.maxAttempts,
    });
    return { jobId: row.id };
  }
}

/** Re-export token for module wiring. */
export { JOB_QUEUE_PORT };
