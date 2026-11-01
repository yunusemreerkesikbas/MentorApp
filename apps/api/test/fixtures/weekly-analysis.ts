import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import type { Pool } from "pg";
import { expect } from "vitest";
import { weeklyReviewWindows } from "../../src/modules/coaching/domain/weekly-review";
import request from "../browser-request";

export async function weeklyAccount(
  app: INestApplication,
  pool: Pool,
  premium = false,
) {
  const signup = await request(app.getHttpServer())
    .post("/v1/auth/signup")
    .send({
      email: `weekly-${randomUUID()}@example.test`,
      password: "WeeklyQa!2026",
      displayName: "Weekly QA",
      kvkkAccepted: true,
      termsAccepted: true,
      ageEligibilityConfirmed: true,
    });
  expect(signup.status).toBe(201);
  const user = {
    id: signup.body.user.id as string,
    token: signup.body.accessToken as string,
  };
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.role','SERVICE',true)");
    await client.query(
      `insert into plan_tasks(user_id, task_date, title, status)
       select $1, $2, 'Weekly QA ' || n, 'DONE' from generate_series(1,3) n`,
      [user.id, weeklyReviewWindows().startDate],
    );
    if (premium) {
      const plan = randomUUID();
      await client.query(
        `insert into plans(id,name,period_months,price_minor,currency,trial_days,is_active)
         values ($1,'Weekly QA',1,19900,'TRY',7,true)`,
        [plan],
      );
      await client.query(
        `insert into subscriptions(user_id,plan_id,status,provider,provider_ref,current_period_start,current_period_end)
         values ($1,$2,'ACTIVE','FAKE',$3,now(),now()+interval '30 days')`,
        [user.id, plan, `weekly-${user.id}`],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  return user;
}
