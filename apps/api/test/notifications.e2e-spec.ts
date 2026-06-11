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

  it("enqueue + cron completes send-email job", async () => {
    const queue = app.get<JobQueuePort>(JOB_QUEUE_PORT);
    const { jobId } = await queue.enqueue(JobName.SEND_EMAIL, {
      to: "queue-test@local.dev",
      template: "identity.verify-email",
      variables: { displayName: "Test", link: "http://localhost/verify" },
    });

    const res = await request(app.getHttpServer())
      .post("/v1/internal/cron/process-jobs")
      .set("x-cron-secret", cronSecret);

    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(res.body.completed).toBeGreaterThanOrEqual(1);

    const { JobRepository } = await import(
      "../src/modules/notifications/infrastructure/job.repository"
    );
    const repo = app.get(JobRepository);
    const row = await repo.findById(jobId);
    expect(row?.status).toBe(JobStatus.COMPLETED);
  });
});
