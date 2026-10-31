import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";
import { DRIZZLE } from "../src/database/database.constants";
import type { Database } from "../src/database/drizzle";
import { withServiceContext } from "../src/database/rls";
import { configOverrides } from "../src/database/schema";
import request from "./browser-request";
import { createTestApp } from "./app-harness";
import { assertLocalTestDatabase } from "./database-target";

const keys = ["DATABASE_URL", "ADMIN_ACCESS_MODE", "AI_PROVIDER", "VISION_PROVIDER",
  "OPENAI_API_KEY", "GEMINI_API_KEY"] as const;
const previousEnv = new Map(keys.map(key => [key, process.env[key]]));
const run = randomUUID();

describe("credential-free disabled AI startup (local HTTP/Postgres)", () => {
  let app: INestApplication;
  let db: Database;
  let previousRows: (typeof configOverrides.$inferSelect)[] | undefined;
  let user: { id: string; token: string };
  const fetch = vi.fn(() => { throw new Error("Provider request forbidden in this fixture"); });
  const readRows = () => withServiceContext(db, tx => tx.select().from(configOverrides)
    .where(eq(configOverrides.key, "ai.enabled")));

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    assertLocalTestDatabase(databaseUrl);
    process.env.DATABASE_URL = databaseUrl;
    process.env.ADMIN_ACCESS_MODE = "disabled";
    process.env.AI_PROVIDER = "disabled";
    process.env.VISION_PROVIDER = "disabled";
    // Empty process values prevent dotenv from importing developer provider credentials.
    process.env.OPENAI_API_KEY = "";
    process.env.GEMINI_API_KEY = "";
    vi.stubGlobal("fetch", fetch);
    const { AppModule } = await import("../src/app.module");
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = createTestApp(module, { authRateLimits: false });
    db = app.get(DRIZZLE);
    previousRows = await readRows();
    await withServiceContext(db, tx => tx.insert(configOverrides).values({ key: "ai.enabled", value: true })
      .onConflictDoUpdate({ target: configOverrides.key, set: { value: true } }));
    await app.init();
    const signup = await request(app.getHttpServer()).post("/v1/auth/signup").send({
      email: `disabled-ai-${run}@example.invalid`, password: "Sifre1234", displayName: "Synthetic user",
      kvkkAccepted: true, termsAccepted: true, ageEligibilityConfirmed: true,
    });
    expect(signup.status).toBe(201);
    user = { id: signup.body.user.id, token: signup.body.accessToken };
  }, 90_000);

  afterAll(async () => {
    try {
      const savedRows = previousRows;
      if (savedRows) {
        await withServiceContext(db, async tx => {
          await tx.delete(configOverrides).where(eq(configOverrides.key, "ai.enabled"));
          if (savedRows.length) await tx.insert(configOverrides).values(savedRows);
        });
        expect(await readRows()).toEqual(savedRows);
      }
    } finally {
      try { await app?.close(); } finally {
        vi.unstubAllGlobals();
        for (const key of keys) {
          const value = previousEnv.get(key);
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    }
  });

  it("boots without provider credentials and reports AI closed despite a stored true override", async () => {
    expect(app.get(ConfigService).get("OPENAI_API_KEY")).toBeFalsy();
    expect(app.get(ConfigService).get("GEMINI_API_KEY")).toBeFalsy();
    expect((await readRows())[0]?.value).toBe(true);
    const response = await request(app.getHttpServer()).get("/v1/app/availability");
    expect(response.status).toBe(200);
    expect(response.body.aiCoach).toBe(false);
    expect(await app.get(ConfigRegistryService).get("ai.enabled")).toBe(false);
  });

  it("denies direct text/photo operations while preserving own-account access", async () => {
    const server = app.getHttpServer();
    const auth = { Authorization: `Bearer ${user.token}` };
    expect((await request(server).get("/v1/users/me").set(auth)).status).toBe(200);
    const access = await request(server).get("/v1/coach/photo-access").set(auth);
    expect(access.status).toBe(200);
    expect(access.body).toMatchObject({ canCategorize: false, reason: "AI_DISABLED" });
    for (const response of [
      await request(server).post("/v1/coach/chat").set(auth).send({ message: "Test" }),
      await request(server).post(`/v1/mock-exams/${randomUUID()}/categorize-photo`).set(auth)
        .send({ storageKey: `mock-exams/${user.id}/${randomUUID()}.jpg` }),
      await request(server).post("/v1/coaching/notebook/entries/prelabel").set(auth)
        .send({ storageKey: `notebook/${user.id}/${randomUUID()}.jpg`, examId: randomUUID() }),
    ]) {
      expect(response.status).toBe(404);
      expect(response.body.code).toBe("AI_DISABLED");
    }
    await expect(app.get(ConfigRegistryService).set(user.id, "ai.enabled", true))
      .rejects.toMatchObject({ code: "ADMIN_CONFIG_INVALID_VALUE" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
