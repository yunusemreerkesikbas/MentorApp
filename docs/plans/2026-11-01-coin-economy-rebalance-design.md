# Coin economy rebalance: value, effort and Premium protection

Date: 2026-11-01 · Status: design, awaiting approval · Owner track: W6 economy (+ web economy UI)

## Why

The owner opened the app and saw "+5" after finishing a daily quest. It felt cheap: the effort and
the reward did not match. That "+5" is the daily-ritual XP toast (`economy-sync.tsx`), a small
3-second notice. The full-screen `CoinCelebration` only fires for Coin, which a free user gets at
most once a week (15 Coin for 5 active days).

The goal is a system that does three things at once:

1. **Keeps students active:** finishing a quest feels earned, every active day.
2. **Makes Premium features reachable with effort:** a free student can taste AI with Coin, but
   only by studying.
3. **Protects Premium:** Coin must never become a cheap Premium substitute, and Coin earned while
   paying must not turn into a stockpile that replaces paying later.

The product is pre-launch: no real user holds a balance, so amounts can change freely.

## Cost reality (context for the numbers)

| | Value |
| --- | --- |
| Premium monthly (seeded placeholder) | 249 TL, ~200 TL net after KDV and iyzico |
| AI chat message, `gpt-4o-mini` (current default) | ~0.03 TL (est. 3k in / 400 out tokens) |
| AI chat message, `gpt-5` (roadmap target) | ~0.75 TL (with reasoning tokens) |
| Diligent free user, Coin earned per month | ~650 Coin (rewarded ads off) |
| Its AI cost per month (all spent on chat) | ~0.4 TL on gpt-4o-mini, ~10 TL on gpt-5 (~5% of Premium net) |

Direct LLM cost is not the main risk. The main risks are perceived cheapness and Premium
cannibalization. The design keeps study earning per week unchanged in real terms and changes how it
looks and when it arrives. Rewarded ads stay off at launch.

## Decisions (made by the owner in conversation)

1. **All XP and Coin amounts ×10.** Pure denomination change: the economy keeps its ratios, the
   numbers on screen grow ("+50 XP", "+150 Coin", "50 Coin a message").
2. **Premium earns XP, not Coin.** While a user is Premium, organic Coin earning stops. XP, levels,
   streaks and quest completion continue. Rationale: Premium already includes the AI uses, so Coin
   has nowhere to go; a stockpile built while paying would let a lapsed user skip paying in exam
   season. When Premium ends, the student earns Coin from zero, by studying.
3. **Daily Coin + weekly bonus for free users.** Every active day gives +10 Coin with a small coin
   animation. Five active days in the ISO week give a +100 Coin bonus with the existing full-screen
   celebration. Weekly total stays 5×10 + 100 = 150 (equal to today's 15 ×10). "Active day" keeps
   its current meaning: ≥1 completed focus session or ≥1 done plan task. Logging in alone earns
   nothing.
4. **Prices ×10, ladder unchanged.** Small uses cost under a week of effort, big uses about two.
5. **No balance cap and no expiry at launch.** The existing per-feature rate limits already bound how
   fast a stockpile can be spent (5 coin messages/day, 1 analysis per week, 2 Wrapped per 30 days,
   1 plan preview/day, 2 notebook slots ever). A cap would feel like a penalty and would swallow
   invite rewards. Revisit if the admin economy float shows the average unspent free balance above
   ~6 weeks of earning (~1,000 Coin).

## New defaults

All in `apps/api/src/common/config/config.catalog.ts` unless noted. Raise any `max` bound that the
new default or a reasonable admin value (×10 of today's) would exceed.

| Key | Today | New |
| --- | --- | --- |
| `economy.coin.daily_cap` | 50 | 500 |
| `economy.coin.weekly_cap` | 200 | 2000 |
| `economy.invite.reward_coin` | 20 | 200 |
| `economy.quest.onboarding_reward_coin` | 10 | 100 |
| `economy.quest.daily_ritual_reward_xp` | 5 | 50 |
| `economy.quest.streak_milestone_reward_xp` | 25 | 250 |
| `economy.quest.effort_milestone_reward_xp` | 25 | 250 |
| `economy.quest.weekly_ritual_reward_xp` | 20 | 200 |
| `economy.quest.weekly_allowance_reward_coin` | 15 | 100 (bonus, daily Coin added separately) |
| `economy.quest.daily_active_reward_coin` (new) | n/a | 10 |
| `economy.coin.ai_chat_cost` | 5 | 50 |
| `economy.coin.plan_preview_cost` | 20 | 200 |
| `economy.coin.streak_freeze_cost` | 20 | 200 |
| `economy.coin.deep_analysis_cost` (also prices Wrapped) | 25 | 250 |
| `economy.coin.notebook_slot_cost` | 20 | 200 |
| `forum.xp.accepted_answer` | 25 | 250 |
| `forum.xp.thread_posted` | 2 | 20 |
| `ads.rewarded.web.reward_coin` (bounds 1..50) | 5 | 10, bounds 1..500 (*our call*, see below) |
| `ads.rewarded.web.daily_limit` | 2 | 1 (*our call*, see below) |
| `TIER_THRESHOLDS` in `packages/core/src/index.ts` | 0, 100 … 10000 | each ×10 (0, 1000 … 100000) |

Daily cap check: the busiest realistic day (signup: profile 100 + email 100 + active day 10, or a
Friday: daily 10 + weekly bonus 100 + one invite 200) stays under 500.

Rate limits (counts, not Coin) stay as they are: `ai.chat.free_coin_daily_limit`,
`ai.plan.coin_daily_limit`, `coaching.weekly_recap.coin_limit`, `economy.notebook_slots.max_per_user`.

## Behaviour details

### Daily active-day Coin

- New quest in `QUEST_CATALOG`, e.g. `daily.active-day`: category `daily_ritual`, period `daily`,
  `rewardUnit: "COIN"`, completes on the first completed focus session or done plan task of the UTC
  day (same source the weekly effort quest counts). Reward from the new config key. Killable via
  `economy.quest.disabled_ids` like every quest.
- `weekly.effort-allowance` keeps its id and target (5 active days), reward becomes the 100 bonus.
- Same idempotency, cap and economy-off semantics as existing grants (ref per user per UTC date).
- Trap: `coinReward()` in `quest-progress.ts` pays the onboarding amount to every non-weekly Coin
  quest. The daily quest must read its own key, or it pays 100.
- *Our call:* daily Coin is paid on every active day, not only the first five. A 7-day week pays
  7×10 + 100 = 170 (not exactly 150), a 4-day week pays 40 (today: 0). Both are intended: every
  study day is rewarded, and the gap to the bonus stays the motivator.

### Rewarded ads (stay OFF at launch, owner's decision 2026-11-01)

- **Why off:** (1) "Coin is earned by studying" is the message of this whole change; a "watch an ad,
  get Coin" button on the panel teaches the opposite. (2) Launch-volume revenue is tiny (rough
  estimate ~0.1–0.25 TL per rewarded web view in Turkey). (3) Rewarded Web has no server-side
  verification, so completions can be faked; the production guards in `ads.service.ts`
  (`serverVerificationUnavailable` and `completeRewardSession`) stay as they are. (4) Google
  approval and a production rewarded unit are not in place yet.
- **When to revisit:** the mobile app (AdMob offers server-side verification, so no guard needs to
  be removed), or free web DAU above ~1,000.
- **Ready for that day (only defaults change now, no flag turns on):**
  `ads.rewarded.web.reward_coin = 10` and `ads.rewarded.web.daily_limit` 2 → **1**. One ad pays at
  most one study day (10); two ads would out-earn studying and nearly double free Coin per month.
  A reward of 5 would bring back the "+5 feels cheap" problem. Ad Coin uses the small daily notice,
  not the full-screen overlay. All ad enable flags stay off; launch docs saying rewarded ads are
  closed stay true.

### Premium earns no Coin

- "Premium" means `EntitlementService.getEntitlement(...).isPremium`, which already covers TRIALING,
  ACTIVE and coach-sponsored seats.
- `daily.active-day` is hidden from a Premium user's quest views and never granted while Premium.
  XP quests are unchanged.
- **Weekly chest stays for Premium, paying XP (owner's decision).** `weekly.effort-allowance` is the
  panel chest: the today-path end node and the chest row in the quests card (`CHEST_QUEST_ID` in
  `today-path-model.ts`, `daily-quests-card.tsx`) and `WeeklyChestService`. For a Premium user it
  keeps its place and target and pays `economy.quest.weekly_ritual_reward_xp` (200 XP) instead of
  Coin; its row and celebration show XP, never a Coin amount. Panel layout is identical for both
  plans. The reward unit is decided at evaluation time from the entitlement.
- A Coin quest completed while Premium is not paid later (same "no backpay" rule as economy-off).
  When Premium ends, the next active day earns normally; the weekly bonus counts the week's active
  days from source data as today, so a mid-week lapse can still complete it.
- Rewarded ads already never show to Premium.
- Onboarding Coin (profile, email) is granted regardless of plan. *Builder's/our call:* it is a
  one-time 200 Coin welcome, and it softens the trial-end moment ("you have 200 Coin = 4 messages").
- **Invite reward stays 200 Coin for every inviter, Premium included (owner's decision).** It is
  tied to a paying friend, so its cost is covered; the Coin is useful once Premium ends. Invite copy
  is unchanged.
- Spending is unchanged: Premium is never debited for included uses; a Premium user who still holds
  Coin from before can keep it.

### Celebration

- Daily active-day Coin: a small coin notice, not the full-screen overlay (a daily full-screen
  overlay would become noise). Reuse `CoinCelebrationVisual` at a small size inside the existing
  toast surface, or an equivalent compact variant; chime optional/quiet. Exact form left to the
  builder within DESIGN.md tokens.
- Weekly bonus, onboarding and invite Coin: existing full-screen `CoinCelebration`.
- XP toast unchanged (now shows "+50 XP").
- `EconomySync` currently routes every COIN receipt to the full-screen overlay
  (`economy-sync.tsx:66`); it needs to tell the daily grant apart (by reason/refType).

### Copy and fixed amounts

- `landing-journey.tsx` hard-codes default amounts (+5 XP, +20 XP, +25 XP, +15 Coin) in props and its
  doc comment; update to the new defaults (+50, +200, +250, daily +10 Coin, weekly +100 Coin).
- `apps/web/messages/{tr,en}.json` leaderboard preview values (640/520/480 XP) ×10.
- Any comment or doc that states "15 = 3 chat messages" or old prices (config descriptions,
  `economy.md` launch-rules table, roadmap header note) is updated.
- New user-facing strings follow `docs/copy/voice.md` (companion register, no em dash, "hak not
  ödül"). The daily notice is short, e.g. "+10 Coin · Bugün de çalıştın".

### Environments

- Pre-launch, so no balance migration. But "existing DB overrides beat code defaults": any economy
  key already overridden in a database keeps its old value, and a partial override breaks the
  ratios (e.g. `ai_chat_cost` left at 5 while rewards go ×10 makes Coin 10× cheaper).
- `apps/api/scripts/apply-local-economy-launch.ts` only runs against a local database and lists 11
  keys. Extend its list to every key in the table above so local DBs follow.
- Production (there is no stage environment, owner 2026-11-01): the plan includes an audit step.
  List every overridden key in the economy, forum-XP and ads categories in production and either
  delete the override (fall back to the new default) or set the ×10 value, all keys in one operator
  session, following the attended procedure in `docs/core/deployment.md`. Document the step there.
- Dev balances will look small next to new prices; no backfill.

## Non-goals

- Balance cap or Coin expiry (decided against; revisit with float data).
- Display ad placements (blog, forum, overviews): unchanged by this design; they keep their own
  review gates in `docs/features/ads.md`.
- New Coin sinks, Premium price changes, AI model change, XP leaderboard opening.
- Changing per-feature rate limits.

## Anti-goals (would be a failure even if it works)

- Coin becomes a realistic way to get through exam season without Premium.
- A full-screen celebration every day.
- Coin for logging in or for social chat (roadmap §3 stays).
- Ads out-earning study: a free user's daily ad Coin must not exceed one study day's Coin.
- A Premium user's quest list or chest showing a Coin reward they will not receive.

## Monitoring

- `GET /v1/admin/metrics/economy` today reports one outstanding float across all users, and its
  reach figure counts weekly-allowance earners against all XP-active users (Premium included, so it
  will read low once Premium stops earning Coin). The "average unspent free balance" trigger is not
  measured yet. *Our call:* out of scope here; add that figure when the cap question is revisited.
  Until then the total float divided by free active users is a rough proxy.
- Trigger to revisit a cap: average unspent free balance above ~1,000 Coin.
- Streak rescue costs Coin for everyone and Premium no longer earns Coin. The feature is off at
  launch (`economy.streak_rescue.enabled=false`); *our call:* a Premium bypass is a follow-up for
  when it is turned on, not part of this change.
- Watch AI cost per free user if the text model moves to gpt-5.

## Left to the builder

- Quest id naming, migration need (none expected for config defaults; a new quest id needs no
  schema change unless the catalog is mirrored in DB), test updates for amounts and tiers.
- Exact compact celebration component and its motion within DESIGN.md.
- Where the Premium check lives (quest evaluation vs grant path), as long as only organic Coin
  earning is affected and admin adjustments still work.

## Open (needs the owner)

None. Premium chest and Premium inviter were settled on 2026-11-01 (see Behaviour details).
