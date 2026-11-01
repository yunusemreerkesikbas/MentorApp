import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import { Pool, type PoolClient } from "pg";
import { ConfigRegistryService } from "../../src/common/config/config-registry.service";
import type { ConfigKey } from "../../src/common/config/config.catalog";
import { EconomyService } from "../../src/modules/economy/application/economy.service";
import { createTestApp } from "../app-harness";
import request from "../browser-request";
import { expect } from "vitest";

export async function economyAuditHarness() {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { AppModule } = await import("../../src/app.module");
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = createTestApp(module, { authRateLimits: false });
  await app.init();
  const config = module.get(ConfigRegistryService);
  const economy = module.get(EconomyService);
  const signup = async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({
        email: `economy-audit-${randomUUID()}@example.test`,
        password: "EconomyQa!2026",
        displayName: "Economy QA",
        kvkkAccepted: true,
        termsAccepted: true,
        ageEligibilityConfirmed: true,
      });
    expect(res.status).toBe(201);
    return {
      id: res.body.user.id as string,
      token: res.body.accessToken as string,
    };
  };
  const actor = await signup();
  const set = (key: ConfigKey, value: unknown) =>
    config.set(actor.id, key, value);
  const tx = async (run: (client: PoolClient) => Promise<void>) => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.role','SERVICE',true)");
      await run(client);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  };
  const seedWeek = (userId: string, monday: string, count = 5) =>
    tx(async (client) => {
      for (let i = 0; i < count; i++) {
        const date = new Date(`${monday}T12:00:00Z`);
        date.setUTCDate(date.getUTCDate() + i);
        const day = date.toISOString().slice(0, 10);
        await client.query(
          "insert into plan_tasks(user_id,task_date,title,status) values ($1,$2,'Historical study','DONE')",
          [userId, day],
        );
        await client.query(
          "insert into daily_activity(user_id,activity_date,tasks_done) values ($1,$2,1)",
          [userId, day],
        );
      }
    });
  return { app, pool, economy, set, signup, tx, seedWeek };
}
