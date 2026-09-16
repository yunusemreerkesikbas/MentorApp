/** Local launch configuration only. Dry-run by default; pass --apply, then restart the local API. */
import "dotenv/config";
import { Pool } from "pg";
import { CONFIG_CATALOG, type ConfigKey } from "../src/common/config/config.catalog";

const keys: ConfigKey[] = [
  "community.leaderboard.enabled", "economy.streak_rescue.enabled",
  "ads.rewarded.enabled", "ads.placement.dashboard_rewarded_coin.enabled",
  "economy.quest.disabled_ids", "economy.quest.onboarding_reward_coin",
  "economy.quest.weekly_allowance_reward_coin", "economy.quest.weekly_allowance_active_days_target",
  "economy.invite.reward_coin", "economy.coin.ai_chat_cost", "economy.coin.deep_analysis_cost",
];

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Database URL is required");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(connectionString).hostname)) {
    throw new Error("This maintenance script only supports a local database");
  }
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.role','SERVICE',true)");
    const apply = process.argv.includes("--apply");
    for (const key of keys) {
      const result = await client.query<{ value: unknown }>("select value from config_overrides where key=$1", [key]);
      const before = result.rows[0]?.value ?? CONFIG_CATALOG[key].default;
      let after = CONFIG_CATALOG[key].default;
      if (key === "economy.quest.disabled_ids") {
        // Keep any independent kill-switches the developer already set.
        after = [...new Set(`${String(before)},${String(after)}`.split(",").map(s => s.trim()).filter(Boolean))].join(",");
      }
      CONFIG_CATALOG[key].schema.parse(after);
      console.log(JSON.stringify({ key, before, after, apply }));
      if (apply) await client.query(
        "insert into config_overrides (key,value) values ($1,$2::jsonb) on conflict (key) do update set value=excluded.value, updated_by=null, updated_at=now()",
        [key, JSON.stringify(after)],
      );
    }
    await client.query(apply ? "commit" : "rollback");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
