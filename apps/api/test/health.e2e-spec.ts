import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * End-to-end against a real Postgres (docker `mentor_test` db). Verifies the base wiring:
 * global prefix, exception filter (ApiError), i18n, and the health probes.
 */
describe("base infrastructure (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Point at the isolated test DB before the module reads its env.
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("GET /v1/health → 200 liveness", async () => {
    const res = await request(app.getHttpServer()).get("/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /v1/health/ready → 200 with DB up", async () => {
    const res = await request(app.getHttpServer()).get("/v1/health/ready");
    expect(res.status).toBe(200);
    expect(res.body.info.database.status).toBe("up");
  });

  it("unknown route → 404 ApiError envelope", async () => {
    const res = await request(app.getHttpServer()).get("/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
    expect(typeof res.body.message).toBe("string");
  });

  it("localizes the message from Accept-Language (en)", async () => {
    const res = await request(app.getHttpServer())
      .get("/v1/does-not-exist")
      .set("Accept-Language", "en");
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });
});
