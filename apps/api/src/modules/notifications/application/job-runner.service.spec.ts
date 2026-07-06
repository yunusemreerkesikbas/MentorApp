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

const config = {
  get: vi.fn(async () => 1),
};

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

    const runner = new JobRunnerService(db, jobs as never, config as never);
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

    const runner = new JobRunnerService(db, jobs as never, config as never);
    const result = await runner.processBatch(1);

    expect(result.dead).toBe(1);
    // Missing handler is permanent: marked DEAD directly, never rescheduled via markFailed.
    expect(jobs.markDead).toHaveBeenCalledOnce();
    expect(jobs.markFailed).not.toHaveBeenCalled();
  });

  it("polls pending jobs automatically on the configured interval", async () => {
    vi.useFakeTimers();
    const handler = vi.fn().mockResolvedValue(undefined);
    const jobs = {
      claimBatch: vi.fn().mockResolvedValueOnce([makeJob()]).mockResolvedValue([]),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
    };
    const db = {
      transaction: async <T>(cb: (tx: unknown) => Promise<T>) =>
        cb({ execute: async () => undefined }),
    } as never;

    const runner = new JobRunnerService(db, jobs as never, config as never);
    runner.registerHandler(JobName.SEND_EMAIL, handler);
    await runner.onModuleInit();

    try {
      await vi.advanceTimersByTimeAsync(1000);

      expect(handler).toHaveBeenCalledOnce();
    } finally {
      runner.onModuleDestroy();
      vi.useRealTimers();
    }
  });

  it("does not overlap polling ticks while a batch is still running", async () => {
    vi.useFakeTimers();
    let releaseHandler!: () => void;
    const handler = vi.fn(
      () => new Promise<void>((resolve) => {
        releaseHandler = resolve;
      }),
    );
    const jobs = {
      claimBatch: vi.fn().mockResolvedValue([makeJob()]),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
    };
    const db = {
      transaction: async <T>(cb: (tx: unknown) => Promise<T>) =>
        cb({ execute: async () => undefined }),
    } as never;

    const runner = new JobRunnerService(db, jobs as never, config as never);
    runner.registerHandler(JobName.SEND_EMAIL, handler);
    await runner.onModuleInit();

    try {
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);

      expect(jobs.claimBatch).toHaveBeenCalledOnce();

      releaseHandler();
      await vi.runOnlyPendingTimersAsync();

      expect(jobs.markCompleted).toHaveBeenCalledOnce();
    } finally {
      runner.onModuleDestroy();
      vi.useRealTimers();
    }
  });

  it("continues polling after a failed batch", async () => {
    vi.useFakeTimers();
    const handler = vi.fn().mockResolvedValue(undefined);
    const jobs = {
      claimBatch: vi
        .fn()
        .mockRejectedValueOnce(new Error("db unavailable"))
        .mockResolvedValueOnce([makeJob()]),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
    };
    const db = {
      transaction: async <T>(cb: (tx: unknown) => Promise<T>) =>
        cb({ execute: async () => undefined }),
    } as never;

    const runner = new JobRunnerService(db, jobs as never, config as never);
    runner.registerHandler(JobName.SEND_EMAIL, handler);
    await runner.onModuleInit();

    try {
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);

      expect(jobs.claimBatch).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledOnce();
      expect(jobs.markCompleted).toHaveBeenCalledOnce();
    } finally {
      runner.onModuleDestroy();
      vi.useRealTimers();
    }
  });

  it("stops polling when the module is destroyed", async () => {
    vi.useFakeTimers();
    const jobs = {
      claimBatch: vi.fn().mockResolvedValue([]),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
    };
    const db = {
      transaction: async <T>(cb: (tx: unknown) => Promise<T>) =>
        cb({ execute: async () => undefined }),
    } as never;

    const runner = new JobRunnerService(db, jobs as never, config as never);
    await runner.onModuleInit();
    runner.onModuleDestroy();

    try {
      await vi.advanceTimersByTimeAsync(3000);

      expect(jobs.claimBatch).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
