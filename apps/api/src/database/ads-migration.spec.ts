import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(__dirname, "../../drizzle/0087_perpetual_taskmaster.sql"), "utf8");
const stabilizationSql = readFileSync(
  resolve(__dirname, "../../drizzle/0088_gifted_phil_sheldon.sql"),
  "utf8",
);

describe("ads migration", () => {
  it.each(["ad_reward_sessions", "coin_grant_reservations"])(
    "forces service/admin-only RLS on %s",
    (table) => {
      expect(sql).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      expect(sql).toContain(`current_setting('app.role', true) IN ('SERVICE', 'ADMIN')`);
    },
  );

  it("keeps provider transaction ids unique for future SSV", () => {
    expect(sql).toContain("ad_reward_sessions_provider_tx_unique_idx");
    expect(sql).toContain('WHERE "ad_reward_sessions"."provider_transaction_id" is not null');
  });
});

describe("ads stabilization migration", () => {
  it("expires stale control rows before enforcing one created session", () => {
    const release = stabilizationSql.indexOf('UPDATE "coin_grant_reservations"');
    const expire = stabilizationSql.indexOf('UPDATE "ad_reward_sessions"');
    const unique = stabilizationSql.indexOf("ad_reward_sessions_user_active_unique_idx");

    expect(release).toBeGreaterThanOrEqual(0);
    expect(expire).toBeGreaterThan(release);
    expect(unique).toBeGreaterThan(expire);
  });

  it("adds idempotency and bounded cleanup indexes", () => {
    expect(stabilizationSql).toContain("ad_reward_sessions_user_idempotency_unique_idx");
    expect(stabilizationSql).toContain("ad_reward_sessions_status_expiry_idx");
  });
});
