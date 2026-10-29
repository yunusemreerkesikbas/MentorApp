import { afterEach, describe, expect, it, vi } from "vitest";
import { Logger } from "@nestjs/common";
import { JobRunnerService } from "./job-runner.service";
import type { JobRow } from "../infrastructure/job.repository";

vi.mock("@sentry/nestjs", () => ({ captureException: vi.fn(() => "fixture-event") }));

function fixture() {
  const row: JobRow = {
    id: "heartbeat-job", name: "heartbeat.fixture", payload: {}, status: "PENDING",
    attempts: 0, maxAttempts: 3, lastError: null,
    createdAt: new Date(), updatedAt: new Date(), runAt: new Date(),
  };
  const rows = [row];
  const db = { transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
    execute: async () => undefined,
  }) };
  const repository = {
    quarantineInterrupted: async (_tx: unknown, limit: number, timeoutSeconds: number) => {
      const expired = rows.filter((item) => item.status === "RUNNING" && Date.now() - item.updatedAt.getTime() > timeoutSeconds * 1000).slice(0, limit);
      for (const item of expired) {
        item.status = "DEAD";
        item.lastError = "Execution interrupted; manual review required.";
      }
      return expired.map((item) => ({ ...item }));
    },
    claimBatch: async () => {
      if (row.status !== "PENDING") return [];
      row.status = "RUNNING";
      row.attempts += 1;
      row.updatedAt = new Date();
      return [{ ...row }];
    },
    heartbeat: async (_tx: unknown, job: JobRow) => {
      if (row.status !== "RUNNING" || row.attempts !== job.attempts) return false;
      row.updatedAt = new Date();
      return true;
    },
    markCompleted: async (_tx: unknown, id: string, attempts = row.attempts) => {
      if (row.id !== id || row.status !== "RUNNING" || row.attempts !== attempts) return false;
      row.status = "COMPLETED";
      return true;
    },
  };
  const config = { get: async (key: string) => key.endsWith("running_timeout_seconds") ? 60 : 10 };
  const runner = () => new JobRunnerService(db as never, repository as never, config as never);
  return { row, rows, repository, runner };
}

describe("job execution heartbeat", () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("keeps a slow live handler out of interrupted-job quarantine", async () => {
    vi.useFakeTimers();
    const f = fixture();
    const worker = f.runner();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    worker.registerHandler("heartbeat.fixture", async () => { started(); await gate; });
    const batch = worker.processBatch(1);
    await ready;
    const initialHeartbeat = f.row.updatedAt.getTime();
    try {
      await vi.advanceTimersByTimeAsync(80_000);
      expect(f.row.updatedAt.getTime()).toBeGreaterThan(initialHeartbeat);
      await f.runner().processBatch(1);
      expect(f.row.status).toBe("RUNNING");
    } finally {
      release();
      await batch;
    }
    expect(f.row.status).toBe("COMPLETED");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up the heartbeat after handler failure", async () => {
    vi.useFakeTimers();
    const f = fixture();
    Object.assign(f.repository, {
      markFailed: async () => { f.row.status = "PENDING"; return true; },
    });
    const worker = f.runner();
    worker.registerHandler("heartbeat.fixture", async () => { throw new Error("fixture failure"); });
    await worker.processBatch(1);
    expect(f.row.status).toBe("PENDING");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not retry a successful side effect when recording completion fails", async () => {
    const f = fixture();
    f.repository.markCompleted = async () => { throw new Error("completion storage failed"); };
    Object.assign(f.repository, {
      markFailed: async () => { f.row.status = "PENDING"; return true; },
    });
    let sideEffects = 0;
    const worker = f.runner();
    worker.registerHandler("heartbeat.fixture", async () => { sideEffects += 1; });
    await expect(worker.processBatch(1)).rejects.toThrow(/completion.*recorded/i);
    expect(f.row.status).toBe("RUNNING");
    await worker.processBatch(1);
    expect(sideEffects).toBe(1);
  });

  it("waits for the recovery cooldown instead of scanning on every empty poll", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.row.status = "COMPLETED";
    const worker = f.runner();
    await worker.processBatch(1);
    f.row.status = "RUNNING";
    f.row.updatedAt = new Date(Date.now() - 120_000);
    await vi.advanceTimersByTimeAsync(59_000);
    await worker.processBatch(1);
    expect(f.row.status).toBe("RUNNING");
    await vi.advanceTimersByTimeAsync(1_001);
    expect((await worker.processBatch(1)).dead).toBe(1);
    expect(f.row.status).toBe("DEAD");
  });

  it("drains another full recovery page immediately without exceeding the batch limit", async () => {
    const f = fixture();
    f.row.status = "RUNNING";
    f.row.updatedAt = new Date(Date.now() - 120_000);
    f.rows.push({ ...f.row, id: "second-interrupted-job" });
    const worker = f.runner();
    const first = await worker.processBatch(1);
    expect(first).toEqual({ processed: 1, completed: 0, failed: 0, dead: 1 });
    expect(f.rows.filter((item) => item.status === "RUNNING")).toHaveLength(1);
    const second = await worker.processBatch(1);
    expect(second).toEqual({ processed: 1, completed: 0, failed: 0, dead: 1 });
    expect(f.rows.every((item) => item.status === "DEAD")).toBe(true);
  });

  it("continues an execution after a transient heartbeat failure without leaking its error", async () => {
    vi.useFakeTimers();
    const f = fixture();
    const warning = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    f.repository.heartbeat = async () => { throw new Error("private-fixture-value"); };
    const worker = f.runner();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    worker.registerHandler("heartbeat.fixture", async () => { started(); await gate; });
    const batch = worker.processBatch(1);
    await ready;
    try { await vi.advanceTimersByTimeAsync(20_000); }
    finally { release(); await batch; }
    expect(f.row.status).toBe("COMPLETED");
    expect(warning).toHaveBeenCalled();
    expect(JSON.stringify(warning.mock.calls)).not.toContain("private-fixture-value");
    expect(vi.getTimerCount()).toBe(0);
  });
});
