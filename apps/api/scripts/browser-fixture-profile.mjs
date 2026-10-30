/** Dedicated browser fixture database only. Restart the API after selecting a profile. */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import pg from "pg";

export function browserFixtureDatabase(env) {
  assert.equal(env.NODE_ENV, "test", "Browser fixtures require NODE_ENV=test");
  assert.equal(env.APP_ENV, "development", "Browser fixtures cannot run in production");
  assert.ok(env.TEST_DATABASE_URL, "Explicit TEST_DATABASE_URL is required");
  const url = new URL(env.TEST_DATABASE_URL);
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol));
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Loopback database required");
  assert.match(url.pathname, /^\/[a-zA-Z0-9_]+_test$/, "Dedicated _test database required");
  assert.equal(url.search + url.hash, "", "Connection overrides are not allowed");
  for (const key of ["DATABASE_URL", "DATABASE_MIGRATION_URL"]) {
    if (env[key]) assert.equal(new URL(env[key]).href, url.href, `${key} must match the test database`);
  }
  return env.TEST_DATABASE_URL;
}

export function browserFixtureFlags(profile) {
  assert.ok(["enabled", "core-trial"].includes(profile), "Select enabled or core-trial");
  const enabled = profile === "enabled";
  return {
    "ai.enabled": enabled,
    "community.social.enabled": enabled,
    "forum.enabled": enabled,
    "community.leaderboard.enabled": enabled,
    "coaching.study_rooms.enabled": enabled,
    "mentorship.enabled": enabled,
    "mentorship.applications.open": enabled,
    "mentorship.seats.sponsorship_enabled": false,
    "economy.enabled": enabled,
    "payments.web.enabled": enabled,
    "payments.mobile.enabled": enabled,
    "mentorship.seats.billing_enabled": enabled,
    "mentorship.seats.mobile_billing_enabled": enabled,
    "payments.web.redirect_to_mobile": false,
    "community.achievements.enabled": true,
    "signup.enabled": true,
    "signup.pilot.enabled": false,
    "ads.enabled": false,
    "identity.auth_rate.signup_ip_limit": 1000,
  };
}

export async function prepareBrowserFixture(profile, env = process.env) {
  const connectionString = browserFixtureDatabase(env);
  const flags = browserFixtureFlags(profile);
  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.role','SERVICE',true)");
    for (const [key, value] of Object.entries(flags)) {
      await client.query(
        "insert into config_overrides (key,value) values ($1,$2::jsonb) on conflict (key) do update set value=excluded.value, updated_by=null, updated_at=now()",
        [key, JSON.stringify(value)],
      );
    }
    await client.query("commit");
    console.log(`Browser fixture profile prepared: ${profile}`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await prepareBrowserFixture(process.argv[2]);
}
