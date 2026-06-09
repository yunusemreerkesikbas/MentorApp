import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Readiness must report 503 when the DB is unreachable, while liveness stays 200.
 * Points the pool at an unreachable port (lazy pool → app boots; the SELECT 1 fails).
 */
describe("health when DB is down (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DATABASE_URL = "postgres://mentor:mentor@localhost:1/mentor";
    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("liveness stays 200", async () => {
    const res = await request(app.getHttpServer()).get("/v1/health");
    expect(res.status).toBe(200);
  });

  it("readiness returns 503 (terminus body, not ApiError)", async () => {
    const res = await request(app.getHttpServer()).get("/v1/health/ready");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("error");
    expect(res.body.details.database.status).toBe("down");
  }, 15000);
});
