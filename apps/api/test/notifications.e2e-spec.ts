import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../src/shared/ports/job-queue.port";
import { JobName } from "../src/shared/notifications/constants";
import { JobStatus } from "../src/shared/notifications/constants";

describe("notifications queue (e2e)", () => {
  let app: INestApplication;
  const cronSecret = "test-cron-secret-min-32-characters!!";

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    process.env.JWT_ACCESS_SECRET ??= "test-secret-test-secret-test-secret!!";
    process.env.CRON_SECRET = cronSecret;
    // Force the no-op (logger) email adapter regardless of a local .env POSTMARK_TOKEN, so the
    // send-email job completes deterministically (matches CI, where no token is set). An empty
    // value is kept by dotenv (it never overrides an already-set process.env var).
    process.env.POSTMARK_TOKEN = "";

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();
  }, 90_000);

  afterAll(async () => {
    await app?.close();
  });

  it("POST /v1/internal/cron/process-jobs rejects missing secret", async () => {
    const res = await request(app.getHttpServer()).post("/v1/internal/cron/process-jobs");
    expect(res.status).toBe(401);
  });

  it("the mentorship risk digest is behind the cron secret too", async () => {
    const res = await request(app.getHttpServer()).post(
      "/v1/internal/cron/dispatch-mentorship-risk-digest",
    );
    expect(res.status).toBe(401);
  });

  it("the risk digest does nothing at all while its flag is off", async () => {
    // Its own flag, not `mentorship.enabled`: the coach surface can open long before anyone
    // starts receiving bulk mail about their students.
    const res = await request(app.getHttpServer())
      .post("/v1/internal/cron/dispatch-mentorship-risk-digest")
      .set("x-cron-secret", cronSecret);
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(res.body).toEqual({ sent: 0, skipped: 0 });
  });

  it("enqueue + cron completes send-email job", async () => {
    const queue = app.get<JobQueuePort>(JOB_QUEUE_PORT);
    const { jobId } = await queue.enqueue(JobName.SEND_EMAIL, {
      to: "queue-test@local.dev",
      template: "identity.verify-email",
      variables: { displayName: "Test", link: "http://localhost/verify" },
    });

    const { JobRepository } = await import(
      "../src/modules/notifications/infrastructure/job.repository"
    );
    const repo = app.get(JobRepository);

    // Production runs the cron periodically: a job enqueued at run_at=now() is picked up on a
    // following tick. Mirror that here (poll a few times) instead of assuming a single immediate
    // call wins the sub-millisecond enqueue→claim boundary.
    let row: Awaited<ReturnType<typeof repo.findById>>;
    for (let attempt = 0; attempt < 10; attempt++) {
      const res = await request(app.getHttpServer())
        .post("/v1/internal/cron/process-jobs")
        .set("x-cron-secret", cronSecret);
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);

      row = await repo.findById(jobId);
      if (row?.status === JobStatus.COMPLETED) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    expect(row?.status).toBe(JobStatus.COMPLETED);
  });
});
