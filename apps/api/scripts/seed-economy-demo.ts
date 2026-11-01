/**
 * Dev-only Coin economy demo (2026-11-01 ×10 rebalance): two fresh KPSS students to try it by hand.
 *
 *   ekonomi-ucretsiz@demo.test   free: 5 active days this week, nothing today → chest 100 Coin,
 *                                daily "+10 Coin" waits for today's first task or session
 *   ekonomi-premium@demo.test    Premium (ACTIVE premium-monthly): same week → chest 200 XP,
 *                                no daily Coin quest
 *
 * Same password as `seed-weekly-chest-demo.ts`. Weeks are UTC (server days). Once a day or a chest
 * is paid it stays paid, so for a clean run change the emails or use a fresh database.
 *
 * Run: pnpm --filter @mentor/api exec ts-node -T scripts/seed-economy-demo.ts
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import * as argon2 from "argon2";
import { Pool, type PoolClient } from "pg";
import { addDays, isoWeekStart, todayIso } from "../src/modules/coaching/domain/date.util";
import { CURRENT_TERMS_VERSION } from "../src/modules/identity/domain/identity.constants";

const DEMO_PASSWORD = "SandikDemo2026";

function stableUuid(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32);
  return [hex.slice(0, 8), hex.slice(8, 12), `4${hex.slice(13, 16)}`, `8${hex.slice(17, 20)}`, hex.slice(20)].join("-");
}

async function upsertUser(c: PoolClient, email: string, name: string, username: string): Promise<string> {
  const found = await c.query<{ id: string }>("select id from users where lower(email) = lower($1)", [email]);
  if (found.rows[0]) return found.rows[0].id;
  const created = await c.query<{ id: string }>(
    `insert into users (email, password_hash, display_name, username, exam_type, email_verified_at,
       kvkk_accepted_at, terms_accepted_at, terms_version, age_eligibility_confirmed_at)
     values ($1, $2, $3, $4, 'KPSS', now(), now(), now(), $5, now()) returning id`,
    [email, await argon2.hash(DEMO_PASSWORD), name, username, CURRENT_TERMS_VERSION],
  );
  return created.rows[0]!.id;
}

/** One done plan task and one 30-minute focus session per day. */
async function seedDays(c: PoolClient, userId: string, days: string[]): Promise<void> {
  for (const day of days) {
    const startedAt = new Date(`${day}T09:00:00Z`);
    await c.query(
      `insert into study_sessions (id, user_id, started_at, ended_at, preset, planned_focus_minutes,
         actual_focus_seconds, subject, status)
       values ($1, $2, $3, $4, 'custom', 30, 1800, 'Matematik', 'COMPLETED') on conflict (id) do nothing`,
      [stableUuid(`${userId}:${day}:session`), userId, startedAt, new Date(startedAt.getTime() + 30 * 60_000)],
    );
    await c.query(
      `insert into plan_tasks (id, user_id, task_date, title, subject, status, sort_order)
       values ($1, $2, $3, 'Paragraf çalışması', 'Türkçe', 'DONE', 0) on conflict (id) do nothing`,
      [stableUuid(`${userId}:${day}:task`), userId, day],
    );
    await c.query(
      `insert into daily_activity (user_id, activity_date, has_session, tasks_done) values ($1, $2, true, 1)
       on conflict (user_id, activity_date) do update set has_session = true, tasks_done = 1, updated_at = now()`,
      [userId, day],
    );
  }
}

async function main(): Promise<void> {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Local database only.");

  const today = todayIso();
  const monday = isoWeekStart(today);
  // Five days before today in this week when they fit (Saturday/Sunday), else last week's Mon-Fri.
  const days = addDays(monday, 4) < today
    ? Array.from({ length: 5 }, (_, i) => addDays(monday, i))
    : Array.from({ length: 5 }, (_, i) => addDays(addDays(monday, -7), i));

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('app.role','SERVICE',true)");
    const free = await upsertUser(c, "ekonomi-ucretsiz@demo.test", "Ekonomi Ücretsiz", "ekonomi_ucretsiz");
    const premium = await upsertUser(c, "ekonomi-premium@demo.test", "Ekonomi Premium", "ekonomi_premium");
    await seedDays(c, free, days);
    await seedDays(c, premium, days);
    const hasSub = await c.query("select 1 from subscriptions where user_id = $1 and status = 'ACTIVE'", [premium]);
    if (!hasSub.rows[0]) {
      await c.query(
        `insert into subscriptions (user_id, plan_id, status, provider, provider_ref, current_period_start, current_period_end)
         values ($1, 'premium-monthly', 'ACTIVE', 'FAKE', $2, now(), now() + interval '30 days')`,
        [premium, `fake_economy_demo_${premium}`],
      );
    }
    await c.query("commit");
    console.log(`Active days: ${days.join(", ")} · today (UTC): ${today}`);
  } catch (error) {
    await c.query("rollback");
    throw error;
  } finally {
    c.release();
    await pool.end();
  }
}

void main();
