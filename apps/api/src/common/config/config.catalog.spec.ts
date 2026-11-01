import { describe, expect, it } from "vitest";
import { CONFIG_CATALOG, type ConfigKey } from "./config.catalog";

// docs/plans/2026-11-01-coin-economy-rebalance-design.md: ×10 denomination, daily Coin, ads ≤ a study day.
describe("2026-11-01 economy rebalance defaults", () => {
  const expected: Record<string, number> = {
    "economy.coin.daily_cap": 500,
    "economy.coin.weekly_cap": 2000,
    "economy.invite.reward_coin": 200,
    "economy.quest.onboarding_reward_coin": 100,
    "economy.quest.daily_ritual_reward_xp": 50,
    "economy.quest.streak_milestone_reward_xp": 250,
    "economy.quest.effort_milestone_reward_xp": 250,
    "economy.quest.weekly_ritual_reward_xp": 200,
    "economy.quest.weekly_allowance_reward_coin": 100,
    "economy.quest.daily_active_reward_coin": 10,
    "economy.coin.ai_chat_cost": 50,
    "economy.coin.plan_preview_cost": 200,
    "economy.coin.streak_freeze_cost": 200,
    "economy.coin.deep_analysis_cost": 250,
    "economy.coin.notebook_slot_cost": 200,
    "forum.xp.accepted_answer": 250,
    "forum.xp.thread_posted": 20,
    "ads.rewarded.web.reward_coin": 10,
    "ads.rewarded.web.daily_limit": 1,
  };

  it.each(Object.entries(expected))("%s defaults to %i and passes its own schema", (key, value) => {
    const entry = CONFIG_CATALOG[key as ConfigKey];
    expect(entry?.default).toBe(value);
    expect(entry?.schema.safeParse(value).success).toBe(true);
  });

  it("accepts a 500 Coin ad reward (bounds raised)", () => {
    expect(CONFIG_CATALOG["ads.rewarded.web.reward_coin"].schema.safeParse(500).success).toBe(true);
  });

  it("fits the signup day (profile 100 + email 100 + active day 10) under the daily Coin cap", () => {
    expect(100 + 100 + 10).toBeLessThanOrEqual(CONFIG_CATALOG["economy.coin.daily_cap"].default as number);
  });

  it("keeps every ad switch off at launch", () => {
    expect(CONFIG_CATALOG["ads.enabled"].default).toBe(false);
    expect(CONFIG_CATALOG["ads.rewarded.enabled"].default).toBe(false);
    expect(CONFIG_CATALOG["ads.placement.dashboard_rewarded_coin.enabled"].default).toBe(false);
  });
});
