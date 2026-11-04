/**
 * Dev-only deep analysis demo: one Premium KPSS student whose last completed week can open the
 * weekly report ("Haftamı aç", no Coin) with a filled deep analysis.
 *
 *   derin-analiz@demo.test   Premium (FAKE premium-monthly), two weeks of exams, sessions and tasks
 *                            from `seed-analysis-demo.ts` (8 attempts, recap schedule)
 *
 * Same password as `seed-economy-demo.ts` / `seed-weekly-chest-demo.ts`. Rerunnable: the user and
 * subscription are upserted, the analysis seed uses stable ids.
 *
 * Run: pnpm --filter @mentor/api exec ts-node -T scripts/seed-deep-analysis-demo.ts
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import * as argon2 from "argon2";
import { Pool } from "pg";
import { CURRENT_TERMS_VERSION } from "../src/modules/identity/domain/identity.constants";

const DEMO_PASSWORD = "SandikDemo2026";
const EMAIL = "derin-analiz@demo.test";

async function main(): Promise<void> {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Local database only.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('app.role','SERVICE',true)");
    const found = await c.query<{ id: string }>("select id from users where lower(email) = lower($1)", [EMAIL]);
    const userId = found.rows[0]?.id ?? (await c.query<{ id: string }>(
      `insert into users (email, password_hash, display_name, username, exam_type, email_verified_at,
         kvkk_accepted_at, terms_accepted_at, terms_version, age_eligibility_confirmed_at)
       values ($1, $2, 'Derin Analiz', 'derin_analiz', 'KPSS', now(), now(), now(), $3, now()) returning id`,
      [EMAIL, await argon2.hash(DEMO_PASSWORD), CURRENT_TERMS_VERSION],
    )).rows[0]!.id;
    const hasSub = await c.query("select 1 from subscriptions where user_id = $1 and status = 'ACTIVE'", [userId]);
    if (!hasSub.rows[0]) await c.query(
      `insert into subscriptions (user_id, plan_id, status, provider, provider_ref, current_period_start, current_period_end)
       values ($1, 'premium-monthly', 'ACTIVE', 'FAKE', $2, now(), now() + interval '30 days')`,
      [userId, `fake_deep_analysis_demo_${userId}`],
    );
    await c.query("commit");
  } catch (error) {
    await c.query("rollback");
    throw error;
  } finally {
    c.release();
    await pool.end();
  }
  // ponytail: reuse the analysis seed as-is rather than copying its 400 lines of fixtures.
  execFileSync(process.execPath, [require.resolve("ts-node/dist/bin"), "-T", "scripts/seed-analysis-demo.ts", `--email=${EMAIL}`],
    { stdio: "inherit", cwd: `${__dirname}/..` });
  console.log(`Ready: ${EMAIL}`);
}

void main();
