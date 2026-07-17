import type { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { validateEnv } from "../src/config/env.validation";
import { DatabaseModule } from "../src/database/database.module";
import { HealthModule } from "../src/health/health.module";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Readiness must report 503 when the DB is unreachable, while liveness stays 200.
 * Boots only the real health + database boundary, without unrelated feature lifecycle hooks.
 */
describe("health when DB is down (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DATABASE_URL = "postgres://mentor:mentor@localhost:1/mentor";
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        DatabaseModule,
        HealthModule,
      ],
    }).compile();
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
