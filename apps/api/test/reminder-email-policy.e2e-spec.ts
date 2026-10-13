import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";
import { DRIZZLE, PG_POOL } from "../src/database/database.constants";
import { withServiceContext } from "../src/database/rls";
import { COACHING_QUERY_PORT } from "../src/modules/coaching/domain/coaching-query.port";
import { AuthService } from "../src/modules/identity/application/auth.service";
import { CURRENT_TERMS_VERSION } from "../src/modules/identity/domain/identity.constants";
import { UsersRepository } from "../src/modules/identity/infrastructure/users.repository";
import { DailyReminderService } from "../src/modules/notifications/application/daily-reminder.service";
import { JobRunnerService } from "../src/modules/notifications/application/job-runner.service";
import { JobRepository } from "../src/modules/notifications/infrastructure/job.repository";
import { NotificationPreferencesRepository } from "../src/modules/notifications/infrastructure/notification-preferences.repository";
import { PostgresJobQueueAdapter } from "../src/modules/notifications/infrastructure/postgres-job-queue.adapter";
import { EMAIL_PORT } from "../src/shared/ports/email.port";
import { EmailTemplate, JobName } from "../src/shared/notifications/constants";
import { createTestApp } from "./app-harness";

describe("pilot daily reminder email control (real PostgreSQL)", () => {
  let app: INestApplication;
  let pool: Pool;
  let registry: ConfigRegistryService;
  let runner: JobRunnerService;
  let queue: PostgresJobQueueAdapter;
  let jobs: JobRepository;
  let actorId: string;
  let admin: Pool | undefined;
  let databaseCreated = false;
  const database = `mentor_reminder_${randomUUID().replaceAll("-", "")}_test`;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const runId = Date.now();
  const sendTransactional = vi.fn(async () => undefined);
  const candidates = vi.fn();
  const key = "notifications.daily_reminder.email_enabled";

  beforeAll(async () => {
    const target = new URL(process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test");
    if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) || !target.pathname.endsWith("_test")) {
      throw new Error("Reminder fixtures require a localhost test database; no cloud database is accepted.");
    }
    target.pathname = "/postgres";
    admin = new Pool({ connectionString: target.toString() });
    await admin.query(`CREATE DATABASE "${database}"`);
    databaseCreated = true;
    target.pathname = `/${database}`;
    process.env.DATABASE_URL = target.toString();
    const migrationPool = new Pool({ connectionString: target.toString() });
    try {
      await migrate(drizzle(migrationPool), { migrationsFolder: resolve(__dirname, "../drizzle") });
    } finally {
      await migrationPool.end();
    }
    const { AppModule } = await import("../src/app.module");
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EMAIL_PORT).useValue({ sendTransactional })
      .overrideProvider(COACHING_QUERY_PORT).useValue({ listDailyReminderCandidates: candidates }).compile();
    app = createTestApp(module, { authRateLimits: false });
    pool = module.get(PG_POOL);
    registry = module.get(ConfigRegistryService);
    runner = module.get(JobRunnerService);
    queue = module.get(PostgresJobQueueAdapter);
    jobs = module.get(JobRepository);
    actorId = (await module.get(UsersRepository).createService({
      email: `reminder-${runId}@test.local`, displayName: "Reminder Fixture", passwordHash: "unused-fixture-hash",
      kvkkAcceptedAt: new Date(), termsAcceptedAt: new Date(), termsVersion: CURRENT_TERMS_VERSION,
      ageEligibilityConfirmedAt: new Date(),
    })).id;
    await withServiceContext(module.get(DRIZZLE), (tx) => module.get(NotificationPreferencesRepository)
      .update(tx, actorId, { emailEnabled: true, pushEnabled: true }));
    candidates.mockResolvedValue([{ userId: actorId, email: `reminder-${runId}@test.local`, displayName: "Reminder Fixture" }]);
    await app.init();
    runner.onModuleDestroy(); // Drive the real runner explicitly, without a racing background tick.
  }, 90_000);

  beforeEach(async () => {
    sendTransactional.mockClear();
    await registry.set(actorId, key, false);
  });

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      try {
        if (databaseCreated) await admin?.query(`DROP DATABASE "${database}" WITH (FORCE)`);
      } finally {
        await admin?.end();
        if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = originalDatabaseUrl;
      }
    }
  });

  it("retains inbox/push while leaving the user's email preference intact", async () => {
    expect(await app.get(DailyReminderService).dispatchForToday()).toEqual({ enqueued: 1, skipped: 0 });
    const inbox = await pool.query("SELECT id FROM user_notifications WHERE user_id = $1", [actorId]);
    expect(inbox.rowCount).toBe(1);
    const prefs = await pool.query("SELECT email_enabled FROM notification_preferences WHERE user_id = $1", [actorId]);
    expect(prefs.rows[0].email_enabled).toBe(true);
    const mail = await pool.query("SELECT id FROM jobs WHERE payload->>'to' = $1", [`reminder-${runId}@test.local`]);
    expect(mail.rowCount).toBe(0);
  });

  it("consumes a previously queued daily email without sending or retrying it", async () => {
    const { jobId } = await queue.enqueue(JobName.SEND_EMAIL, { to: `reminder-${runId}@test.local`, template: EmailTemplate.DAILY_REMINDER });
    await runner.processBatch();
    expect(await jobs.findById(jobId)).toMatchObject({ status: "COMPLETED", attempts: 1 });
    expect(sendTransactional).not.toHaveBeenCalled();
  });

  it("still delivers real guarded verification/reset jobs while reminder email is paused", async () => {
    const email = `critical-mail-${runId}@test.local`;
    await app.get(AuthService).signup({ email, password: "Password123", displayName: "Critical Mail Fixture",
      kvkkAccepted: true, termsAccepted: true, ageEligibilityConfirmed: true });
    await runner.processBatch();
    expect(sendTransactional).toHaveBeenCalledWith(expect.objectContaining({ to: email, template: EmailTemplate.VERIFY_EMAIL }));
    sendTransactional.mockClear();
    await app.get(AuthService).forgotPassword({ email });
    await runner.processBatch();
    expect(sendTransactional).toHaveBeenCalledWith(expect.objectContaining({ to: email, template: EmailTemplate.RESET_PASSWORD }));
  });

  it("delivers reminder email after explicit re-enable", async () => {
    await registry.set(actorId, key, true);
    const { jobId } = await queue.enqueue(JobName.SEND_EMAIL, { to: `reminder-${runId}@test.local`, template: EmailTemplate.DAILY_REMINDER });
    await runner.processBatch();
    expect(await jobs.findById(jobId)).toMatchObject({ status: "COMPLETED", attempts: 1 });
    expect(sendTransactional).toHaveBeenCalledWith(expect.objectContaining({ to: `reminder-${runId}@test.local`, template: EmailTemplate.DAILY_REMINDER }));
  });
});
