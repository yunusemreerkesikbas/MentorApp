import { eq, inArray, sql } from "drizzle-orm";
import * as Sentry from "@sentry/nestjs";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { createDatabase, createPool } from "../src/database/drizzle";
import { withServiceContext } from "../src/database/rls";
import { jobs } from "../src/database/schema";
import { JobRunnerService } from "../src/modules/notifications/application/job-runner.service";
import { JobRepository, type JobRow, type NewJob } from "../src/modules/notifications/infrastructure/job.repository";

vi.mock("@sentry/nestjs", () => ({ captureException: vi.fn(() => "fixture-event") }));

describe("interrupted jobs (PostgreSQL)", () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Explicit isolated TEST_DATABASE_URL required.");
  const pool = createPool(url);
  const db = createDatabase(pool);
  const repository = new JobRepository(db);
  const ids: string[] = [];
  const config = { get: async (key: string) => key.endsWith("running_timeout_seconds") ? 900 : 10 };
  const create = async (values: Partial<NewJob> = {}) => {
    const row = await repository.insert({ name: "interruption.fixture", payload: { privateValue: "fixture-only" }, ...values });
    ids.push(row.id);
    return row;
  };
  const change = (id: string, values: Partial<NewJob>) => withServiceContext(db, (tx) => tx.update(jobs).set(values).where(eq(jobs.id, id)));
  const running = async (values: Partial<NewJob> = {}): Promise<JobRow> => {
    const row = await create(values);
    await change(row.id, { status: "RUNNING", attempts: 1 });
    return (await repository.findById(row.id))!;
  };
  // The real UPDATE trigger refreshes updated_at, so insert old fixtures rather than disabling it.
  const interrupted = async () => {
    const [row] = await withServiceContext(db, (tx) => tx.insert(jobs).values({
      name: "interruption.fixture", payload: { privateValue: "fixture-only" }, status: "RUNNING",
      attempts: 1, updatedAt: new Date(Date.now() - 3_600_000),
    }).returning());
    ids.push(row.id);
    return row;
  };

  afterEach(async () => {
    if (ids.length) await withServiceContext(db, (tx) => tx.delete(jobs).where(inArray(jobs.id, ids)));
    ids.length = 0;
    vi.restoreAllMocks();
  });
  afterAll(() => pool.end());

  it("quarantines an expired execution without replay and continues pending work", async () => {
    const expired = await interrupted();
    const pending = await create();
    const handled: unknown[] = [];
    const alert = vi.mocked(Sentry.captureException);
    alert.mockClear();
    const runner = new JobRunnerService(db, repository, config as never);
    runner.registerHandler("interruption.fixture", async (payload) => { handled.push(payload); });

    const result = await runner.processBatch(5);
    expect((await repository.findById(expired.id))?.status).toBe("DEAD");
    expect((await repository.findById(expired.id))?.lastError).toMatch(/manual review/i);
    expect((await repository.findById(pending.id))?.status).toBe("COMPLETED");
    expect(handled).toHaveLength(1);
    expect(result.dead).toBe(1);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(alert.mock.calls)).not.toContain("privateValue");
  });

  it("leaves a fresh RUNNING row alone", async () => {
    const active = await running();
    const runner = new JobRunnerService(db, repository, config as never);
    await runner.processBatch(1);
    expect((await repository.findById(active.id))?.status).toBe("RUNNING");
  });

  it("does not let a late completion overwrite quarantine", async () => {
    const old = await running();
    await change(old.id, { status: "DEAD", lastError: "manual review" });
    await withServiceContext(db, (tx) => repository.markCompleted(tx, old.id, old.attempts));
    expect((await repository.findById(old.id))?.status).toBe("DEAD");
  });

  it("does not let a failed old attempt rewrite a newer execution", async () => {
    const old = await running();
    await change(old.id, { status: "RUNNING", attempts: 2 });
    await withServiceContext(db, (tx) => repository.markFailed(tx, old, "fixture failure"));
    const current = await repository.findById(old.id);
    expect(current?.status).toBe("RUNNING");
    expect(current?.attempts).toBe(2);
  });

  it("does not let an old heartbeat revive a quarantined row", async () => {
    const old = await running();
    await change(old.id, { status: "DEAD", lastError: "manual review" });
    expect(await withServiceContext(db, (tx) => repository.heartbeat(tx, old))).toBe(false);
    expect((await repository.findById(old.id))?.status).toBe("DEAD");
  });

  it("uses a heartbeat to protect an old but still live execution", async () => {
    const old = await interrupted();
    expect(await withServiceContext(db, (tx) => repository.heartbeat(tx, old))).toBe(true);
    await new JobRunnerService(db, repository, config as never).processBatch(1);
    expect((await repository.findById(old.id))?.status).toBe("RUNNING");
  });

  it("quarantines expired rows once when two recoveries race", async () => {
    const first = await interrupted();
    const second = await interrupted();
    const [a, b] = await Promise.all([
      new JobRunnerService(db, repository, config as never).processBatch(1),
      new JobRunnerService(db, repository, config as never).processBatch(1),
    ]);
    expect(a.dead + b.dead).toBe(2);
    expect((await repository.findById(first.id))?.status).toBe("DEAD");
    expect((await repository.findById(second.id))?.status).toBe("DEAD");
  });

  it("preserves backoff and max attempts for a known handler failure", async () => {
    const row = await create({ maxAttempts: 2 });
    const runner = new JobRunnerService(db, repository, config as never);
    runner.registerHandler("interruption.fixture", async () => { throw new Error("fixture failure"); });
    expect((await runner.processBatch(5)).failed).toBe(1);
    const retried = (await repository.findById(row.id))!;
    expect(retried.status).toBe("PENDING");
    expect(retried.attempts).toBe(1);
    expect(retried.runAt.getTime()).toBeGreaterThan(retried.updatedAt.getTime());
    await withServiceContext(db, (tx) => tx.update(jobs).set({ runAt: sql`now() - interval '1 second'` }).where(eq(jobs.id, row.id)));
    expect((await runner.processBatch(5)).dead).toBe(1);
    expect((await repository.findById(row.id))?.status).toBe("DEAD");
    expect((await repository.findById(row.id))?.attempts).toBe(2);
  });

  it("keeps jobs that have not started pending while the first handler is blocked", async () => {
    const first = await create({ payload: { marker: "first" } });
    const second = await create({ payload: { marker: "second" } });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    let activeMarker = "";
    const runner = new JobRunnerService(db, repository, config as never);
    runner.registerHandler("interruption.fixture", async (payload) => {
      activeMarker = (payload as { marker: string }).marker;
      started();
      await gate;
    });
    const batch = runner.processBatch(2);
    await ready;
    try {
      const waiting = activeMarker === "first" ? second : first;
      expect((await repository.findById(waiting.id))?.status).toBe("PENDING");
    } finally {
      release();
      await batch;
    }
  });
});
