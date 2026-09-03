import { z, type ZodTypeAny } from "zod";

/**
 * Config registry catalog (§9, engineering-principles §2/§8).
 *
 * The catalog is the single source of truth for tunable, admin-editable values + feature flags.
 * Each key declares its Zod schema (validation + bounds), default, category, UI type, sensitivity,
 * and description. The DB (`config_overrides`) only stores admin overrides; the effective value is
 * `override ?? default`. Admins cannot invent keys — only keys defined here are editable.
 *
 * YAGNI: seed only keys with a real purpose now. Other modules (economy, moderation, …) append
 * their own keys here when their slice lands.
 *
 * GUARDRAIL: NEVER put secrets here (API keys, tokens, passwords). Config values are stored in
 * plaintext in `config_overrides` AND written to the admin audit trail (before/after). Secrets live
 * only in env (`config/env.validation.ts`). This registry is for non-secret business config + flags.
 *
 * SCOPE: this is GLOBAL platform config (by design). Per-org/B2B overrides belong in
 * `organizations.settings` (already org-ready, §4 #7) — not here; `config_overrides` has no org_id.
 */
export const ConfigCategory = {
  FEATURE_FLAGS: "feature-flags",
  ECONOMY: "economy",
  AI: "ai",
  COACHING: "coaching",
  IDENTITY: "identity",
  NOTIFICATIONS: "notifications",
  FORUM: "forum",
  ADS: "ads",
  PROMOTIONS: "promotions",
  MENTORSHIP: "mentorship",
} as const;

export const ConfigValueType = {
  BOOLEAN: "boolean",
  NUMBER: "number",
  STRING: "string",
} as const;
export type ConfigValueType =
  (typeof ConfigValueType)[keyof typeof ConfigValueType];

export interface ConfigEntryDef {
  category: string;
  /** UI hint so the admin panel renders the right control. */
  type: ConfigValueType;
  schema: ZodTypeAny;
  default: unknown;
  /** Sensitive (money/coin/commission) → bounds + extra confirmation in the UI. */
  sensitive: boolean;
  description: string;
}

const flag = (def: boolean, description: string): ConfigEntryDef => ({
  category: ConfigCategory.FEATURE_FLAGS,
  type: ConfigValueType.BOOLEAN,
  schema: z.boolean(),
  default: def,
  sensitive: false,
  description,
});

const economyCount = (
  def: number,
  max: number,
  description: string,
): ConfigEntryDef => ({
  category: ConfigCategory.ECONOMY,
  type: ConfigValueType.NUMBER,
  schema: z.number().int().min(0).max(max),
  default: def,
  sensitive: true, // economy values (caps/thresholds) → bounds + audit (§9)
  description,
});

/** Like economyCount but min 1 — quest targets of 0 would auto-complete. */
const economyTarget = (
  def: number,
  max: number,
  description: string,
): ConfigEntryDef => ({
  category: ConfigCategory.ECONOMY,
  type: ConfigValueType.NUMBER,
  schema: z.number().int().min(1).max(max),
  default: def,
  sensitive: true,
  description,
});

const aiCount = (
  def: number,
  max: number,
  description: string,
): ConfigEntryDef => ({
  category: ConfigCategory.AI,
  type: ConfigValueType.NUMBER,
  schema: z.number().int().min(0).max(max),
  default: def,
  sensitive: true, // cost-bearing AI limits → bounds + audit (§7)
  description,
});

const aiPositiveCount = (
  def: number,
  max: number,
  description: string,
): ConfigEntryDef => ({
  category: ConfigCategory.AI,
  type: ConfigValueType.NUMBER,
  schema: z.number().int().min(1).max(max),
  default: def,
  sensitive: true,
  description,
});

const identityCount = (
  def: number,
  max: number,
  description: string,
): ConfigEntryDef => ({
  category: ConfigCategory.IDENTITY,
  type: ConfigValueType.NUMBER,
  schema: z.number().int().min(0).max(max),
  default: def,
  sensitive: false,
  description,
});

const notificationCount = (
  def: number,
  max: number,
  description: string,
): ConfigEntryDef => ({
  category: ConfigCategory.NOTIFICATIONS,
  type: ConfigValueType.NUMBER,
  schema: z.number().int().min(1).max(max),
  default: def,
  sensitive: false,
  description,
});

const coachingCount = (
  def: number,
  min: number,
  max: number,
  description: string,
): ConfigEntryDef => ({
  category: ConfigCategory.COACHING,
  type: ConfigValueType.NUMBER,
  schema: z.number().int().min(min).max(max),
  default: def,
  sensitive: false,
  description,
});

const mentorshipFlag = (def: boolean, description: string): ConfigEntryDef => ({
  category: ConfigCategory.MENTORSHIP,
  type: ConfigValueType.BOOLEAN,
  schema: z.boolean(),
  default: def,
  sensitive: false,
  description,
});

const mentorshipRatio = (def: number, description: string): ConfigEntryDef => ({
  category: ConfigCategory.MENTORSHIP,
  type: ConfigValueType.NUMBER,
  schema: z.number().min(0).max(1),
  default: def,
  sensitive: false,
  description,
});

const mentorshipCount = (
  def: number,
  min: number,
  max: number,
  description: string,
): ConfigEntryDef => ({
  category: ConfigCategory.MENTORSHIP,
  type: ConfigValueType.NUMBER,
  schema: z.number().int().min(min).max(max),
  default: def,
  sensitive: false,
  description,
});

const forumCount = (def: number, min: number, max: number, description: string): ConfigEntryDef => ({
  category: ConfigCategory.FORUM,
  type: ConfigValueType.NUMBER,
  schema: z.number().int().min(min).max(max),
  default: def,
  sensitive: false,
  description,
});

const adsFlag = (def: boolean, description: string): ConfigEntryDef => ({
  category: ConfigCategory.ADS,
  type: ConfigValueType.BOOLEAN,
  schema: z.boolean(),
  default: def,
  sensitive: false,
  description,
});

const adsCount = (def: number, min: number, max: number, description: string): ConfigEntryDef => ({
  category: ConfigCategory.ADS,
  type: ConfigValueType.NUMBER,
  schema: z.number().int().min(min).max(max),
  default: def,
  sensitive: true,
  description,
});

const promotionsFlag = (def: boolean, description: string): ConfigEntryDef => ({
  category: ConfigCategory.PROMOTIONS,
  type: ConfigValueType.BOOLEAN,
  schema: z.boolean(),
  default: def,
  sensitive: true,
  description,
});

const promotionsCount = (
  def: number,
  min: number,
  max: number,
  description: string,
): ConfigEntryDef => ({
  category: ConfigCategory.PROMOTIONS,
  type: ConfigValueType.NUMBER,
  schema: z.number().int().min(min).max(max),
  default: def,
  sensitive: true,
  description,
});

export const CONFIG_CATALOG = {
  "promotions.enabled": promotionsFlag(
    false,
    "Global promotions kill-switch — off means every checkout pays the list price.",
  ),
  "promotions.max_percent": promotionsCount(
    50,
    1,
    90,
    "Ceiling on any single discount, percent of list price. Caps FIXED discounts too.",
  ),
  "promotions.max_discount_periods": promotionsCount(
    1,
    1,
    24,
    "How many charges a discount may cover. Keep at 1 until the payment adapter can honour a multi-period intro price; raising it needs no code change.",
  ),
  "ads.enabled": adsFlag(false, "Global advertising kill-switch."),
  "ads.display.enabled": adsFlag(false, "Enable contextual display inventory."),
  "ads.rewarded.enabled": adsFlag(false, "Enable voluntary rewarded advertising."),
  "ads.placement.knowledge_article_end.enabled": adsFlag(
    false,
    "Enable the single contextual slot at the end of a knowledge article.",
  ),
  "ads.placement.dashboard_rewarded_coin.enabled": adsFlag(
    false,
    "Enable the voluntary dashboard Coin reward offer.",
  ),
  "ads.rewarded.web.reward_coin": adsCount(5, 1, 50, "Coin granted for one completed web ad."),
  "ads.rewarded.web.daily_limit": adsCount(2, 0, 10, "Completed rewarded ads per user per day."),
  "ads.rewarded.web.cooldown_seconds": adsCount(0, 0, 86400, "Delay between rewarded ads."),
  "ads.rewarded.web.session_ttl_seconds": adsCount(300, 30, 900, "Reward session lifetime."),
  "ads.rewarded.web.rollout_percent": adsCount(0, 0, 100, "Stable Free-user rollout percentage."),
  "ai.enabled": flag(
    true,
    "Global AI kill-switch (§4/§8) — turn off all AI features.",
  ),
  "economy.enabled": flag(
    false,
    "Gate for the light-economy module (user-facing balance/earning).",
  ),
  "forum.enabled": flag(
    false,
    "Gate for the forum/community module (zones, threads, moderation).",
  ),
  "community.achievements.enabled": flag(
    false,
    "Expose permanent achievements, celebrations, and achievement notifications.",
  ),
  "forum.coach_bridge.enabled": flag(
    false,
    "Gate for the public-safe community thread to personal AI coach pilot.",
  ),
  "identity.google_oauth.enabled": flag(
    false,
    "Gate for Google sign-in on the public auth screens. Requires GOOGLE_OAUTH_* env vars.",
  ),
  "signup.enabled": flag(
    true,
    "Registration kill-switch — disable new sign-ups.",
  ),
  "coaching.preference_simulation.enabled": flag(
    false,
    "Runtime gate for the free YKS 3D campus and preference comparison beta.",
  ),
  "coaching.study_rooms.enabled": flag(
    false,
    "Gate for themed invite-code study rooms (masa) on the session screen.",
  ),
  "mentorship.enabled": mentorshipFlag(
    false,
    "Gate for the human coach surface (coach roster, invite codes, assignments). Off = W8 endpoints 403.",
  ),
  "mentorship.coach.max_active_students": mentorshipCount(
    20,
    1,
    500,
    "Free active-student quota per coach. Also the invite-code abuse bound (no separate use counter).",
  ),
  "mentorship.invite_code.ttl_days": mentorshipCount(
    14,
    1,
    365,
    "How long a coach's invite code stays redeemable before it must be rotated.",
  ),
  "mentorship.risk.inactive_days": mentorshipCount(
    3,
    1,
    60,
    "Days without a completed session or a done task before a student is flagged INACTIVE.",
  ),
  "mentorship.risk.plan_completion_floor": mentorshipRatio(
    0.5,
    "Share (0-1) of the last week's planned tasks below which a student is flagged PLAN_SLIPPING.",
  ),
  "mentorship.risk.low_mood_ceiling": mentorshipCount(
    2,
    1,
    5,
    "Weekly mean mood check-in (1-5) at or below which a student is flagged LOW_MOOD.",
  ),
  "mentorship.risk_digest.enabled": mentorshipFlag(
    false,
    "Gate for the coach's daily risk digest (in-app + email). Separate from mentorship.enabled so the coach surface can open before anyone gets bulk mail.",
  ),
  "mentorship.risk_digest.repeat_after_days": mentorshipCount(
    7,
    1,
    90,
    "How long a already-reported risk stays quiet before it is worth repeating. Lowering it makes every stale baseline expire at once, so the next run mails everybody.",
  ),
  "identity.verification_email.resend_limit": identityCount(
    1,
    100,
    "Max verification email resend attempts per user within the resend window.",
  ),
  "identity.verification_email.resend_window_seconds": identityCount(
    180,
    86400,
    "Verification email resend rate-limit window in seconds.",
  ),
  "identity.verification_email.token_ttl_seconds": identityCount(
    180,
    86400,
    "Verification email link expiration time in seconds.",
  ),
  "notifications.jobs.poll_interval_seconds": notificationCount(
    10,
    3600,
    "How often API instances poll the jobs table for pending notification/email jobs.",
  ),
  "economy.coin.daily_cap": economyCount(
    50,
    100000,
    "Max coin a user can earn per day (abuse shield).",
  ),
  "economy.coin.weekly_cap": economyCount(
    200,
    1000000,
    "Max coin a user can earn per week (abuse shield).",
  ),
  "economy.coin.min_xp_for_coin": economyCount(
    0,
    1000000,
    "Min XP required before a user can earn coin (anti-Sybil).",
  ),
  "economy.invite.reward_coin": economyCount(
    20,
    100000,
    "Coin granted to the inviter when an invited user converts.",
  ),
  "economy.quest.onboarding_reward_coin": economyCount(
    10,
    100000,
    "Coin granted per completed onboarding quest.",
  ),
  "economy.quest.daily_ritual_reward_xp": economyCount(
    5,
    100000,
    "XP granted per completed daily ritual quest.",
  ),
  "economy.quest.streak_milestone_reward_xp": economyCount(
    25,
    100000,
    "XP granted per completed streak milestone quest.",
  ),
  "economy.quest.effort_milestone_reward_xp": economyCount(
    25,
    100000,
    "XP granted per completed effort milestone quest.",
  ),
  "economy.quest.weekly_ritual_reward_xp": economyCount(
    20,
    100000,
    "XP granted per completed weekly ritual quest.",
  ),
  "economy.quest.weekly_allowance_reward_coin": economyCount(
    15,
    100000,
    "Coin granted for the weekly effort allowance quest — the only RECURRING coin faucet (free tier's earned AI right). 15 = 3 chat messages at the default ai_chat_cost.",
  ),
  "economy.quest.weekly_allowance_active_days_target": economyTarget(
    5,
    7,
    "Active days in the ISO week required for the weekly effort allowance quest (coin faucet).",
  ),
  "economy.quest.weekly_focus_sessions_target": economyTarget(
    5,
    100,
    "Completed focus sessions required for the weekly focus quest.",
  ),
  "economy.quest.weekly_plan_tasks_target": economyTarget(
    10,
    500,
    "Done plan tasks required for the weekly plan quest.",
  ),
  "economy.quest.disabled_ids": {
    category: ConfigCategory.ECONOMY,
    type: ConfigValueType.STRING,
    schema: z.string().max(2000),
    default: "",
    sensitive: false,
    description:
      "Comma-separated quest ids to disable (kill-switch): hidden from all views, never granted. Deploy-free rollback for a misbehaving quest.",
  },
  "economy.coin.ai_chat_cost": economyCount(
    5,
    100000,
    "Coin debited per AI coach chat message (free earned-right path).",
  ),
  "economy.coin.streak_freeze_cost": economyCount(
    20,
    100000,
    "Coin debited to rescue a broken streak by freezing the single missed day it broke on.",
  ),
  "economy.coin.deep_analysis_cost": economyCount(
    25,
    100000,
    "Coin debited to unlock one week's deep-analysis AI narration (premium users are included free).",
  ),
  "forum.xp.accepted_answer": economyCount(
    25,
    1000,
    "XP granted to a user when their forum answer is accepted (slice 3).",
  ),
  "forum.xp.thread_posted": economyCount(
    2,
    1000,
    "XP granted for posting a forum thread/message (feeds the effort leaderboard; capped per day).",
  ),
  "forum.xp.thread_posted_daily_cap": economyCount(
    10,
    1000,
    "Max posts per day that earn XP (anti-farm shield for the leaderboard).",
  ),
  "forum.discovery.trending_window_hours": forumCount(
    72,
    1,
    720,
    "Rolling activity window used by the trending discovery feed.",
  ),
  "forum.discovery.top_window_days": forumCount(
    30,
    1,
    365,
    "Rolling activity window used by the top discovery feed.",
  ),
  "forum.discovery.edit_window_minutes": forumCount(
    30,
    1,
    1440,
    "Owner edit window before an untouched forum thread or post becomes immutable.",
  ),
  "forum.discovery.featured_default_days": forumCount(
    7,
    1,
    90,
    "Default lifetime for a manually featured thread.",
  ),
  "forum.discovery.score.participant_weight": forumCount(
    3,
    0,
    100,
    "Trending/top score weight for each unique participant.",
  ),
  "forum.discovery.score.reaction_weight": forumCount(
    1,
    0,
    100,
    "Trending/top score weight for each positive reaction.",
  ),
  "forum.discovery.score.bookmark_weight": forumCount(
    2,
    0,
    100,
    "Trending/top score weight for each bookmark.",
  ),
  "forum.discovery.score.helpful_weight": forumCount(
    2,
    0,
    100,
    "Trending/top score weight for each helpful vote.",
  ),
  "forum.discovery.score.accepted_answer_bonus": forumCount(
    5,
    0,
    100,
    "Trending/top score bonus for a question with an accepted answer.",
  ),
  "forum.discovery.score.unanswered_question_bonus": forumCount(
    2,
    0,
    100,
    "Small trending/top score bonus for a QA question that has no answers yet.",
  ),
  "ai.chat.daily_limit": aiCount(
    30,
    100000,
    "Max AI coach chat messages a premium user may send per day (cost cap §7).",
  ),
  "ai.plan_draft.daily_limit": aiCount(
    5,
    100000,
    "Max AI weekly plan drafts a premium user may generate per day (cost cap §7).",
  ),
  "ai.chat.free_coin_daily_limit": aiCount(
    5,
    100000,
    "Max AI coach chat messages a free user may send per day via coin (abuse shield; premium limit is separate).",
  ),
  "ai.coach_personalization_v2.rollout_percent": aiCount(
    0,
    100,
    "Stable user-hash rollout percentage for Personalized Mentor V2; 0 instantly restores the legacy chat strategy.",
  ),
  "ai.coach.history_max_messages": aiPositiveCount(
    10,
    40,
    "Maximum persisted messages from the active coach thread replayed into a prompt.",
  ),
  "ai.coach.history_max_characters": aiPositiveCount(
    6_000,
    40_000,
    "Maximum combined characters from active-thread history replayed into a coach prompt.",
  ),
  "ai.coach.memory.transient_ttl_days": aiPositiveCount(
    30,
    365,
    "Expiry window for transient challenge and priority-subject mentor memories.",
  ),
  "ai.photo.monthly_limit": aiCount(
    30,
    100000,
    "Max photo→subject categorizations a premium user may run per rolling 30-day window.",
  ),
  "ai.budget.monthly_cap_usd_cents": aiCount(
    0,
    100_000_000,
    "Monthly AI spend cap in US cents (0 = no cap; e.g. 5000 = $50). Over cap → all AI blocked until next month (§7).",
  ),
  "coaching.session.min_focus_seconds": coachingCount(
    300,
    60,
    3600,
    "Min actual focus seconds for a session to count toward streak, XP quests, and effort milestones.",
  ),
  "coaching.weekly_recap.ready_mock_exam_count": coachingCount(
    1,
    1,
    20,
    "Mock exams in the completed week required to make the weekly recap ready.",
  ),
  "coaching.weekly_recap.ready_session_count": coachingCount(
    2,
    1,
    50,
    "Qualifying focus sessions in the completed week required to make the weekly recap ready.",
  ),
  "coaching.weekly_recap.ready_plan_task_count": coachingCount(
    3,
    1,
    100,
    "Completed plan tasks in the completed week required to make the weekly recap ready.",
  ),
  "coaching.weekly_recap.comparison_min_focus_minutes_delta": coachingCount(
    15,
    1,
    600,
    "Minimum positive focus-minute change required for a weekly recap comparison highlight.",
  ),
  "coaching.weekly_recap.comparison_min_longest_session_minutes_delta":
    coachingCount(
      5,
      1,
      180,
      "Minimum positive longest-session change required for a weekly recap comparison highlight.",
    ),
  "coaching.weekly_recap.comparison_min_active_days_delta": coachingCount(
    1,
    1,
    7,
    "Minimum positive active-day change required for a weekly recap comparison highlight.",
  ),
  "coaching.weekly_recap.comparison_min_plan_tasks_delta": coachingCount(
    1,
    1,
    100,
    "Minimum positive completed-task change required for a weekly recap comparison highlight.",
  ),
  "coaching.weekly_recap.title_rhythm_run_days": coachingCount(
    4,
    1,
    7,
    "Consecutive active days required for the weekly Time Bender title.",
  ),
  "coaching.weekly_recap.title_deep_focus_minutes": coachingCount(
    50,
    1,
    240,
    "Longest qualifying focus session required for the weekly Nebula Diver title.",
  ),
  "coaching.weekly_recap.title_plan_task_count": coachingCount(
    3,
    1,
    100,
    "Completed plan tasks required for the weekly Route Architect title.",
  ),
  "coaching.weekly_recap.title_focused_subject_count": coachingCount(
    3,
    1,
    30,
    "Taxonomy-verified focused subjects required for the weekly Dimension Explorer title.",
  ),
  "coaching.weekly_recap.title_mock_exam_count": coachingCount(
    1,
    1,
    20,
    "Mock exams required for the weekly Phoenix Pilot title.",
  ),
  "coaching.weekly_recap.title_balanced_channel_count": coachingCount(
    2,
    2,
    3,
    "Evidence channels required for the weekly Cosmic Maestro title.",
  ),
  "ai.features.coach.chat.free_enabled": flag(
    false,
    "Allow free users a capped AI coach chat taste.",
  ),
  "ai.features.coach.chat.free_limit": aiCount(
    1,
    100000,
    "Free-user coach chat messages per day when the taste flag is on.",
  ),
  "ai.features.photo.categorize.free_enabled": flag(
    false,
    "Allow free users a capped photo→topic categorization taste.",
  ),
  "ai.features.photo.categorize.free_limit": aiCount(
    1,
    100000,
    "Free-user photo categorizations per 30-day window when the taste flag is on.",
  ),
  "ai.features.plan.ai.free_enabled": flag(
    false,
    "Allow free users a capped AI plan draft/adaptation taste.",
  ),
  "ai.features.plan.ai.free_limit": aiCount(
    1,
    100000,
    "Free-user plan AI calls per day when the taste flag is on.",
  ),
  "ai.features.mood.reflection.free_enabled": flag(
    false,
    "Allow free users a capped mood AI reflection taste.",
  ),
  "ai.features.mood.reflection.free_limit": aiCount(
    1,
    100000,
    "Free-user mood reflections per day when the taste flag is on.",
  ),
  "ai.features.ghost.narration.free_enabled": flag(
    false,
    "Allow free users a capped ghost AI narration taste.",
  ),
  "ai.features.ghost.narration.free_limit": aiCount(
    1,
    100000,
    "Free-user ghost narrations per day when the taste flag is on.",
  ),
  "ai.features.vision.note.free_enabled": flag(
    false,
    "Allow free users a capped vision-board AI note taste.",
  ),
  "ai.features.vision.note.free_limit": aiCount(
    1,
    100000,
    "Free-user vision notes per day when the taste flag is on.",
  ),
  "ai.features.session.reflection.free_enabled": flag(
    false,
    "Allow free users a capped session AI reflection taste.",
  ),
  "ai.features.session.reflection.free_limit": aiCount(
    1,
    100000,
    "Free-user session reflections per day when the taste flag is on.",
  ),
  "ai.features.weekly.narration.free_enabled": flag(
    false,
    "Allow free users a capped weekly AI narration taste.",
  ),
  "ai.features.weekly.narration.free_limit": aiCount(
    1,
    100000,
    "Free-user weekly narrations per 7-day window when the taste flag is on.",
  ),
  "ai.features.daily.greeting.free_enabled": flag(
    false,
    "Allow free users a capped daily AI greeting taste.",
  ),
  "ai.features.daily.greeting.free_limit": aiCount(
    1,
    100000,
    "Free-user daily greetings per day when the taste flag is on.",
  ),
  "ai.features.deep.analysis.free_enabled": flag(
    false,
    "Allow free users a capped deep-analysis unlock without coin.",
  ),
  "ai.features.deep.analysis.free_limit": aiCount(
    1,
    100000,
    "Free-user deep-analysis unlocks per 7-day window when the taste flag is on.",
  ),
} as const satisfies Record<string, ConfigEntryDef>;

export type ConfigKey = keyof typeof CONFIG_CATALOG;

/** Stable flag key constants for consumers (e.g. `configRegistry.get(FeatureFlag.AI_ENABLED)`). */
export const FeatureFlag = {
  AI_ENABLED: "ai.enabled",
  ECONOMY_ENABLED: "economy.enabled",
  FORUM_ENABLED: "forum.enabled",
  COMMUNITY_ACHIEVEMENTS_ENABLED: "community.achievements.enabled",
  FORUM_COACH_BRIDGE_ENABLED: "forum.coach_bridge.enabled",
  GOOGLE_OAUTH_ENABLED: "identity.google_oauth.enabled",
  SIGNUP_ENABLED: "signup.enabled",
  PREFERENCE_SIMULATION_ENABLED: "coaching.preference_simulation.enabled",
  STUDY_ROOMS_ENABLED: "coaching.study_rooms.enabled",
  MENTORSHIP_ENABLED: "mentorship.enabled",
} as const satisfies Record<string, ConfigKey>;

export function isConfigKey(key: string): key is ConfigKey {
  return Object.prototype.hasOwnProperty.call(CONFIG_CATALOG, key);
}
