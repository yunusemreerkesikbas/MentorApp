/**
 * Dev-only weekly chest demo: two KPSS students to try the chest by hand.
 *
 *   sandik-hazir@demo.test   5 active days → ready chest (this week from Friday on, else last week's)
 *   sandik-hafta@demo.test   3 active days this week (as far as today allows) → info sheet
 *
 * Password for both: DEMO_PASSWORD below. Re-run to re-arm an opened chest (clears revealed_at;
 * the Coin is granted once and stays).
 *
 * Run: pnpm --filter @mentor/api seed:weekly-chest-demo
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import * as argon2 from "argon2";
import { Pool, type PoolClient } from "pg";
import { addDays, isoWeekKey, isoWeekStart, todayIso } from "../src/modules/coaching/domain/date.util";
import { CURRENT_TERMS_VERSION } from "../src/modules/identity/domain/identity.constants";

const DEMO_PASSWORD = "SandikDemo2026";
const CHEST_ID = "weekly.effort-allowance";

/** Per active day: focus minutes (0 = no session) and plan tasks done. 5 days, 4 sessions, 6 tasks, 200 min. */
const WEEK = [
  { focus: 40, tasks: 2 },
  { focus: 45, tasks: 0 },
  { focus: 0, tasks: 2 },
  { focus: 50, tasks: 1 },
  { focus: 65, tasks: 1 },
];

function stableUuid(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32);
  return [hex.slice(0, 8), hex.slice(8, 12), `4${hex.slice(13, 16)}`, `8${hex.slice(17, 20)}`, hex.slice(20)].join("-");
}

async function upsertUser(c: PoolClient, email: string, name: string, username: string): Promise<string> {
  const found = await c.query<{ id: string }>("select id from users where lower(email) = lower($1)", [email]);
  if (found.rows[0]) return found.rows[0].id;
  const hash = await argon2.hash(DEMO_PASSWORD);
  const created = await c.query<{ id: string }>(
    `insert into users (email, password_hash, display_name, username, exam_type, email_verified_at,
       kvkk_accepted_at, terms_accepted_at, terms_version, age_eligibility_confirmed_at)
     values ($1, $2, $3, $4, 'KPSS', now(), now(), now(), $5, now()) returning id`,
    [email, hash, name, username, CURRENT_TERMS_VERSION],
  );
  return created.rows[0]!.id;
}

async function seedDays(c: PoolClient, userId: string, days: string[]): Promise<void> {
  for (const [index, day] of days.entries()) {
    const plan = WEEK[index]!;
    if (plan.focus > 0) {
      const startedAt = new Date(`${day}T09:00:00Z`);
      await c.query(
        `insert into study_sessions (id, user_id, started_at, ended_at, preset, planned_focus_minutes,
           actual_focus_seconds, subject, status)
         values ($1, $2, $3, $4, 'custom', $5, $6, 'Matematik', 'COMPLETED')
         on conflict (id) do nothing`,
        [stableUuid(`${userId}:${day}:session`), userId, startedAt,
          new Date(startedAt.getTime() + plan.focus * 60_000), plan.focus, plan.focus * 60],
      );
    }
    for (let t = 0; t < plan.tasks; t++) {
      await c.query(
        `insert into plan_tasks (id, user_id, task_date, title, subject, status, sort_order)
         values ($1, $2, $3, $4, 'Türkçe', 'DONE', $5) on conflict (id) do nothing`,
        [stableUuid(`${userId}:${day}:task:${t}`), userId, day, `Paragraf çalışması ${t + 1}`, t],
      );
    }
    await c.query(
      `insert into daily_activity (user_id, activity_date, has_session, tasks_done) values ($1, $2, $3, $4)
       on conflict (user_id, activity_date) do update set has_session = excluded.has_session,
         tasks_done = excluded.tasks_done, updated_at = now()`,
      [userId, day, plan.focus > 0, plan.tasks],
    );
  }
}

async function main(): Promise<void> {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Local database only.");

  const today = todayIso();
  const monday = isoWeekStart(today);
  const thisWeek = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((d) => d <= today);
  // Five days fit this week from Friday on; earlier in the week the ready chest is last week's.
  const readyDays = thisWeek.length >= 5
    ? thisWeek.slice(0, 5)
    : Array.from({ length: 5 }, (_, i) => addDays(addDays(monday, -7), i));

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('app.role','SERVICE',true)");
    const ready = await upsertUser(c, "sandik-hazir@demo.test", "Sandık Hazır", "sandik_hazir");
    const week = await upsertUser(c, "sandik-hafta@demo.test", "Sandık Hafta", "sandik_hafta");
    await seedDays(c, ready, readyDays);
    await seedDays(c, week, thisWeek.slice(0, 3));
    await c.query(
      "update user_quest_progress set revealed_at = null where user_id = $1 and quest_id = $2 and period_key = $3",
      [ready, CHEST_ID, isoWeekKey(readyDays[0]!)],
    );
    // Other quests' Coin (profile, email) would pop the generic celebration over the demo. Quests
    // grant lazily, so on a fresh DB this catches them only from the second run on.
    await c.query(
      `update economy_reward_receipts r set seen_at = now() from ledger_entries l
        where l.id = r.ledger_id and r.user_id = any($1) and r.seen_at is null and l.reason <> $2`,
      [[ready, week], `quest.${CHEST_ID}`],
    );
    await c.query("commit");
    console.log(`Ready chest: ${readyDays.join(", ")} (${isoWeekKey(readyDays[0]!)})`);
    console.log(`Running week: ${thisWeek.slice(0, 3).join(", ")}`);
  } catch (error) {
    await c.query("rollback");
    throw error;
  } finally {
    c.release();
    await pool.end();
  }
}

void main();
