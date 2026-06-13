import { afterEach, describe, expect, it, vi } from "vitest";
import { JobStatus, JobName } from "../../../shared/notifications/constants";
import { JobRunnerService } from "./job-runner.service";
import type { JobRow } from "../infrastructure/job.repository";

function makeJob(overrides: Partial<JobRow> = {}): JobRow {
  const now = new Date();
  return {
    id: "job-1",
    name: JobName.SEND_EMAIL,
    payload: { to: "a@test.local" },
    status: JobStatus.RUNNING,
    attempts: 1,
    maxAttempts: 3,
    lastError: null,
    runAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("JobRunnerService", () => {
  afterEach(() => vi.restoreAllMocks());

  it("registers and runs a handler to completion", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const jobs = {
      claimBatch: vi.fn().mockResolvedValue([makeJob()]),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
    };
    const db = {
      transaction: async <T>(cb: (tx: unknown) => Promise<T>) =>
        cb({ execute: async () => undefined }),
    } as never;

    const runner = new JobRunnerService(db, jobs as never);
    runner.registerHandler(JobName.SEND_EMAIL, handler);

    const result = await runner.processBatch(10);

    expect(result.processed).toBe(1);
    expect(result.completed).toBe(1);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("marks unknown job names as dead", async () => {
    const jobs = {
      claimBatch: vi.fn().mockResolvedValue([makeJob({ name: "unknown.job" })]),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
      markDead: vi.fn(),
    };
    const db = {
      transaction: async <T>(cb: (tx: unknown) => Promise<T>) =>
        cb({ execute: async () => undefined }),
    } as never;

    const runner = new JobRunnerService(db, jobs as never);
    const result = await runner.processBatch(1);

    expect(result.dead).toBe(1);
    // Missing handler is permanent: marked DEAD directly, never rescheduled via markFailed.
    expect(jobs.markDead).toHaveBeenCalledOnce();
    expect(jobs.markFailed).not.toHaveBeenCalled();
  });
});
