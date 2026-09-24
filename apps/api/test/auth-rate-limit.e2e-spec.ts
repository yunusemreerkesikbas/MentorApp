import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp } from "./app-harness";

describe("auth signup rate limit (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    process.env.JWT_ACCESS_SECRET ??= "test-secret-test-secret-test-secret!!";

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = createTestApp(moduleRef);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("allows five validation attempts and rejects the sixth from one IP", async () => {
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const response = await request(app.getHttpServer()).post("/v1/auth/signup").send({});
      expect(response.status, `attempt ${attempt}`).toBe(attempt <= 5 ? 400 : 429);
    }
  });
});
