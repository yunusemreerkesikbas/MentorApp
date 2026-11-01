# Coin Economy Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make earned XP/Coin feel valuable (×10 denomination, daily Coin for free users) while keeping Coin a free-tier effort path that Premium never stockpiles.

**Architecture:** Amounts are config defaults in the central registry plus the XP tier curve in `@mentor/core`. A new daily Coin quest joins the static quest catalog; a per-quest `premiumReward` field tells `QuestService` / `WeeklyChestService` what a Premium user gets (XP or nothing), read from `EntitlementService`. Web only learns to render an XP chest and to show the daily Coin as a quiet toast.

**Tech Stack:** NestJS + Drizzle (api), Next.js 16 + next-intl (web), Vitest, `@mentor/core`, `@mentor/types`.

**Spec:** [`docs/plans/2026-11-01-coin-economy-rebalance-design.md`](./2026-11-01-coin-economy-rebalance-design.md) (approved 2026-11-01). Read it before any task.

## Global Constraints

- Branch: stay on the current branch (`feature/APP-127`). **No commits.** The branch holds unrelated uncommitted weekly-recap work in shared files (`config.catalog.ts`, `packages/types/src/index.ts`, …); the owner commits. Each task ends at a review checkpoint instead.
- API tests: `pnpm --filter @mentor/api exec vitest run <spec-name>` (the `test -- <name>` form does NOT filter).
- Web tests: `pnpm --filter @mentor/web exec vitest run <spec-name>` (pure logic only, Node env).
- Full suite + lint + typecheck only once, in Task 8.
- User-facing copy follows `docs/copy/voice.md`: "sen", no em dash `—`, no "lütfen", Coin is a "hak", never money.
- UI values from DESIGN.md tokens; no new magic numbers.
- Rewarded ads stay OFF: no ad enable flag changes, the two production guards in `ads.service.ts` stay.
- Pre-launch: no balance migration, no backfill, previously granted ledger rows never change.
- After the work, append a timeline entry to `docs/features/economy.md` (mandatory, Task 7).

## Review Focus

1. Premium user completes the weekly chest (gets XP), then Premium ends the same week → no second chest grant in Coin (the week's progress row already exists). Test in Task 4.
2. Trial and STAFF users are Premium for this rule (`EntitlementService` returns `isPremium: true`) → XP chest, no daily Coin. Test in Task 4 uses `isPremium: true` regardless of reason; no extra code path.
3. Signup day: profile 100 + email 100 + active day 10 = 210 must pass the new `economy.coin.daily_cap` (500). Test in Task 1.
4. API serves an XP chest → web panel still draws the chest node and the quests-card chest row (today both require `rewardUnit === "COIN"` and would silently drop it). Test in Task 5.
5. A Premium user's views never show a Coin amount they will not receive: `daily.active-day` absent, chest row/meta in XP. Tests in Task 4 and Task 5.

---

### Task 1: New defaults (config registry + local launch script)

**Files:**
- Modify: `apps/api/src/common/config/config.catalog.ts` (economy block ~556-668, forum XP ~670-684, ads rewarded ~379-380)
- Modify: `apps/api/scripts/apply-local-economy-launch.ts:6-12`
- Test: `apps/api/src/common/config/config.catalog.spec.ts` (create if missing; else add a `describe`)

**Interfaces:**
- Produces: config key `economy.quest.daily_active_reward_coin` (`economyCount(10, 100000, …)`), consumed by Task 3.

- [ ] **Step 1: Write the failing test** `describe("2026-11-01 economy rebalance defaults")`:

```ts
const expected: Record<string, number> = {
  "economy.coin.daily_cap": 500, "economy.coin.weekly_cap": 2000,
  "economy.invite.reward_coin": 200, "economy.quest.onboarding_reward_coin": 100,
  "economy.quest.daily_ritual_reward_xp": 50, "economy.quest.streak_milestone_reward_xp": 250,
  "economy.quest.effort_milestone_reward_xp": 250, "economy.quest.weekly_ritual_reward_xp": 200,
  "economy.quest.weekly_allowance_reward_coin": 100, "economy.quest.daily_active_reward_coin": 10,
  "economy.coin.ai_chat_cost": 50, "economy.coin.plan_preview_cost": 200,
  "economy.coin.streak_freeze_cost": 200, "economy.coin.deep_analysis_cost": 250,
  "economy.coin.notebook_slot_cost": 200, "forum.xp.accepted_answer": 250,
  "forum.xp.thread_posted": 20, "ads.rewarded.web.reward_coin": 10, "ads.rewarded.web.daily_limit": 1,
};
it.each(Object.entries(expected))("%s defaults to %i and passes its own schema", (key, value) => {
  const entry = CONFIG_CATALOG[key as ConfigKey];
  expect(entry.default).toBe(value);
  expect(entry.schema.safeParse(value).success).toBe(true);
});
it("accepts a 500 Coin ad reward (bounds raised)", () => {
  expect(CONFIG_CATALOG["ads.rewarded.web.reward_coin"].schema.safeParse(500).success).toBe(true);
});
it("signup day (100 + 100 + 10) fits the daily Coin cap", () => {
  expect(100 + 100 + 10).toBeLessThanOrEqual(CONFIG_CATALOG["economy.coin.daily_cap"].default as number);
});
```

- [ ] **Step 2: Run** `pnpm --filter @mentor/api exec vitest run config.catalog` → FAIL (old defaults, unknown key).
- [ ] **Step 3: Implement.** Change the defaults per the table; add `economy.quest.daily_active_reward_coin` next to `weekly_allowance_reward_coin` with description "Coin granted for each active day (≥1 completed focus session or done plan task); free users only. Premium earns no Coin."; ads reward `adsCount(10, 1, 500, …)`, daily limit default 1. Rewrite descriptions that state old math (the "15 = 3 chat messages" line becomes "100 Coin weekly bonus at the active-day target; daily Coin comes from `daily_active_reward_coin`. Free users only."). Do not touch any `*.enabled` flag. Extend the script `keys` list with every key in the table above (keep existing entries).
- [ ] **Step 4: Run** the same command → PASS. Run `pnpm --filter @mentor/api exec vitest run economy.service` → PASS (cap logic untouched).
- [ ] **Step 5: Checkpoint** (no commit).

### Task 2: XP tier curve ×10

**Files:**
- Modify: `packages/core/src/index.ts` (`TIER_THRESHOLDS`)
- Test: `apps/api/src/modules/community/domain/level.spec.ts` (the curve's only spec lives here, see its ponytail note)

- [ ] **Step 1: Update the spec first.** Multiply every XP value and threshold in it by 10: `deriveLevel(0).nextAt` 1000 with progress target 1000; `deriveLevel(999).progress` `{ current: 999, target: 1000, remaining: 1, percent: 99 }`; `deriveLevel(1000)` tier 2, `nextAt: 3000`, target 2000; `deriveLevel(10000)` tier 5, `nextAt: 15000`; `deriveLevel(4110)` tier 3, `currentAt: 3000`, `nextAt: 6000`, progress `{ current: 1110, target: 3000, remaining: 1890, percent: 37 }`; `deriveLevel(56000)` tier 10, target 19000; top tier at `deriveLevel(100000)`, `deriveLevel(999990)` tier 12; negative case `nextAt: 1000`, target 1000.
- [ ] **Step 2: Run** `pnpm --filter @mentor/api exec vitest run level.spec` → FAIL.
- [ ] **Step 3: Implement** `TIER_THRESHOLDS = [0, 1000, 3000, 6000, 10000, 15000, 22000, 30000, 42000, 56000, 75000, 100000]`.
- [ ] **Step 4: Run** → PASS. Then `pnpm --filter @mentor/core build` (or the package's build script) so api/web resolve the new curve.
- [ ] **Step 5: Checkpoint.**

### Task 3: Daily active-day Coin quest

**Files:**
- Modify: `apps/api/src/modules/economy/domain/quest.catalog.ts` (add quest after `daily.mood-checkin`)
- Modify: `apps/api/src/modules/economy/application/quest-progress.ts` (`QuestConfig`, `coinReward`)
- Modify: `apps/api/src/modules/economy/application/quest-config.ts`
- Modify: `apps/api/src/modules/economy/application/quest.service.ts` (`isMet`)
- Modify: `apps/api/src/i18n/locales/{tr,en}/economy.json` (`quests.daily.active-day`)
- Test: `apps/api/src/modules/economy/application/quest.service.spec.ts`

**Interfaces:**
- Consumes: config key from Task 1.
- Produces: quest id `"daily.active-day"` (ledger reason `quest.daily.active-day`, used by Task 6); `QuestConfig.dailyActiveRewardCoin: number`.

- [ ] **Step 1: Write failing tests.** In the spec helper: config mock returns `10` for `economy.quest.daily_active_reward_coin`; signals mock gains `weeklyActiveDates: options.signals?.weeklyActiveDates ?? []`. New `describe("QuestService — daily.active-day")`:
  - `"grants 10 Coin on a day that counts as active"`: `signals: { weeklyActiveDates: ["2026-07-06"] }` → `getUserProgress` contains `{ id: "daily.active-day", rewardUnit: "COIN", rewardAmount: 10, completed: true }` and `economy.grantInServiceTx` was called with `("user-1", Currency.COIN, 10, expect.objectContaining({ reason: "quest.daily.active-day" }), expect.anything())`.
  - `"is not met before any focus session or plan task today"`: `weeklyActiveDates: ["2026-07-05"]` → quest `completed: false`, no COIN grant with that reason.
  - `"weekly chest pays its own bonus, not the daily amount"`: `weeklyAllowanceRewardCoin: 100`, `weeklyActiveDays: 5` → `weekly.effort-allowance` has `rewardAmount: 100`.
- [ ] **Step 2: Run** `pnpm --filter @mentor/api exec vitest run quest.service` → FAIL.
- [ ] **Step 3: Implement.**
  - Catalog entry: `{ id: "daily.active-day", category: "daily_ritual", period: "daily", type: QuestType.DAILY_RITUAL, action: "study-session", rewardUnit: "COIN", priority: 32 }` with a doc comment: free-tier daily faucet, same "active day" as the weekly chest.
  - `coinReward`: `DAILY_RITUAL → cfg.dailyActiveRewardCoin`, `WEEKLY_RITUAL → cfg.weeklyAllowanceRewardCoin`, else onboarding (fixes the trap where any non-weekly Coin quest paid the onboarding amount).
  - `readQuestConfig` reads the new key into `dailyActiveRewardCoin`.
  - `isMet`: `case "daily.active-day": return signals.weeklyActiveDates.includes(signals.date);` (identical definition to the weekly chest's active days).
  - Copy, tr: `{ "title": "Bugün 1 odak seansı ya da 1 plan görevi bitir", "ledgerTitle": "Bugünün aktif günü", "badge": "Ritim" }`; en: `{ "title": "Finish 1 focus session or 1 plan task today", "ledgerTitle": "Today's active day", "badge": <same as en "plan-task-done" badge> }`.
- [ ] **Step 4: Run** `quest.service` and `quest-copy` specs → PASS (quest-copy checks every catalog id has copy).
- [ ] **Step 5: Checkpoint.**

### Task 4: Premium earns XP, not Coin (quests + weekly chest)

**Files:**
- Modify: `apps/api/src/modules/economy/domain/quest.catalog.ts` (`QuestDef.premiumReward`, set on two quests)
- Modify: `apps/api/src/modules/economy/application/quest-progress.ts` (`rewardUnitFor`)
- Modify: `apps/api/src/modules/economy/application/quest.service.ts` (inject `EntitlementService`, use in evaluate + views)
- Modify: `apps/api/src/modules/economy/application/quest-view.ts` (`isPremium` input)
- Modify: `apps/api/src/modules/economy/application/weekly-chest.service.ts` (inject `EntitlementService`, XP reward)
- Modify: `packages/types/src/economy.ts:143` (`WeeklyChestView.reward.unit`)
- Test: `quest.service.spec.ts`, `weekly-chest.service.spec.ts`

**Interfaces:**
- Consumes: `EntitlementService.getEntitlement(userId: string, rolesHint?: string[]): Promise<EntitlementDto>` (`payments/application/entitlement.service.ts`, exported by `PaymentsModule`, already imported by `EconomyModule`).
- Produces:
  - `QuestDef.premiumReward?: "XP" | "HIDDEN"`; `weekly.effort-allowance` → `"XP"`, `daily.active-day` → `"HIDDEN"`. Onboarding Coin quests have none (granted to everyone, spec decision).
  - `export function rewardUnitFor(q: QuestDef, isPremium: boolean): QuestRewardUnit | null` — `null` = hidden for this user; Premium + `"XP"` → `"XP"`; otherwise `q.rewardUnit`.
  - `toQuestViews` input gains `isPremium: boolean`.
  - `WeeklyChestView.reward: { unit: "COIN" | "XP"; amount: number } | null`.
  - `QuestService` and `WeeklyChestService` constructors get `EntitlementService` as the **last** parameter (keeps existing positional spec mocks valid).

- [ ] **Step 1: Write failing tests.** Spec helper: last ctor arg `{ getEntitlement: vi.fn(async () => ({ isPremium: options.premium ?? false })) }`. New `describe("QuestService — Premium earns XP, not Coin")`:
  - `"hides daily.active-day and never grants it"`: `premium: true, signals: { weeklyActiveDates: ["2026-07-06"] }` → no quest with id `daily.active-day` in views; no grant call with reason `quest.daily.active-day`.
  - `"turns the weekly chest into 20 XP"` (mock weekly ritual XP is 20): `premium: true, signals: { weeklyActiveDays: 5 }` → chest view `{ rewardUnit: "XP", rewardAmount: 20, rewardCoin: 0, completed: true }`; grant called with `Currency.XP, 20, objectContaining({ reason: "quest.weekly.effort-allowance" })`.
  - `"still pays onboarding Coin to Premium"`: `premium: true, user: { examType: "KPSS", emailVerified: true }` → COIN grant 10 for `quest.onboarding.profile-setup`.
  - `"does not pay the chest again in Coin after Premium ends the same week"`: run once with premium true (5 active days), flip the entitlement mock to false, run again with the same `rows` → exactly one grant with reason `quest.weekly.effort-allowance`, and it is XP.
  - weekly-chest spec: its config mock gains `economy.quest.weekly_ritual_reward_xp → 20` and its ctor an entitlement mock (`premium` option). `"shows an XP reward to a Premium user"` → `getView` returns `reward: { unit: "XP", amount: 20 }` in PROGRESS state; existing free-user Coin case still returns `{ unit: "COIN", amount: 15 }`.
- [ ] **Step 2: Run** `pnpm --filter @mentor/api exec vitest run quest.service weekly-chest` → FAIL.
- [ ] **Step 3: Implement.**
  - `evaluateAndGrant`: read `isPremium` once (alongside signals/config), skip `q` when `rewardUnitFor(q, isPremium) === null` (not marked completed: if Premium ends that day, the next evaluation grants it), and compute `reward` from `rewardUnitFor` instead of `q.rewardUnit`.
  - `toViews` → `toQuestViews({ …, isPremium })`; `visible` drops `rewardUnitFor(q, isPremium) === null`; `rewardUnit = rewardsEnabled ? rewardUnitFor(q, isPremium)! : "NONE"`.
  - `WeeklyChestService.reward()`: without a row, Premium → `{ unit: "XP", amount: xpReward(CHEST, cfg) }`; with a row → `{ unit: entry.unit, amount: entry.amount }` from the ledger (no more hard-coded `"COIN"`).
- [ ] **Step 4: Run** the same specs plus `quest-trigger` and `economy-uses` specs → PASS.
- [ ] **Step 5: Checkpoint.**

### Task 5: Web panel draws an XP chest

**Files:**
- Modify: `apps/web/src/app/[locale]/(app)/dashboard/_components/today-path-model.ts` (`PathChest`, chest selection ~100-109)
- Modify: `apps/web/src/app/[locale]/(app)/dashboard/_components/today-path.tsx` (`chestMeta` ~166)
- Modify: `apps/web/src/app/[locale]/(app)/dashboard/_components/daily-quests-card.tsx:68`
- Modify: `apps/web/messages/{tr,en}.json` (`chest_meta`, `chest_open_meta`, `quests_chest_reward`)
- Test: `apps/web/src/app/[locale]/(app)/dashboard/_components/today-path-model.spec.ts`

**Interfaces:**
- Consumes: quest view with `rewardUnit: "XP"` for the chest (Task 4).
- Produces: `PathChest.unit: "COIN" | "XP"`.

- [ ] **Step 1: Write failing test** `"keeps the chest for a Premium user whose chest pays XP"`: chest quest `{ id: "weekly.effort-allowance", rewardUnit: "XP", rewardAmount: 200, progressCurrent: 3, progressTarget: 5, completed: false }` → model `chest` equals `{ current: 3, target: 5, reward: 200, unit: "XP", open: false }`; existing Coin test now also expects `unit: "COIN"`; `rewardUnit: "NONE"` still yields `chest: null`.
- [ ] **Step 2: Run** `pnpm --filter @mentor/web exec vitest run today-path-model` → FAIL.
- [ ] **Step 3: Implement.** Model accepts `rewardUnit === "COIN" || rewardUnit === "XP"` and sets `unit`. Messages use one ICU select, tr: `"chest_meta": "{current}/{target} gün · {reward} {unit, select, XP {XP} other {Coin}}"`, `"chest_open_meta": "Açıldı · {reward} {unit, select, XP {XP} other {Coin}}"`, `"quests_chest_reward": "{reward} {unit, select, XP {XP} other {Coin}}"`; en same shape ("days", "Opened"). Pass `unit` at both call sites; the quests card shows the reward span for XP too (`chest.rewardUnit !== "NONE"`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Checkpoint.**

### Task 6: Daily Coin as a quiet notice

**Files:**
- Modify: `apps/web/src/lib/economy.ts` (new pure helper)
- Modify: `apps/web/src/components/economy-sync.tsx:66-67`
- Test: `apps/web/src/lib/coin-celebration.spec.ts`

**Interfaces:**
- Consumes: ledger reasons `quest.daily.active-day` (Task 3) and `ad.reward.completed` (`ADS_REWARD_REASON`, ads module).
- Produces: `export function rewardPresentation(entry: { unit: string; reason: string }): "CELEBRATION" | "COIN_TOAST" | "XP_TOAST"`.

- [ ] **Step 1: Write failing test** `describe("rewardPresentation")`: `{ unit: "COIN", reason: "quest.daily.active-day" }` → `"COIN_TOAST"`; `{ unit: "COIN", reason: "ad.reward.completed" }` → `"COIN_TOAST"`; `{ unit: "COIN", reason: "quest.weekly.effort-allowance" }` → `"CELEBRATION"`; `{ unit: "COIN", reason: "invite.converted" }` → `"CELEBRATION"`; `{ unit: "XP", reason: "quest.weekly.effort-allowance" }` → `"XP_TOAST"`.
- [ ] **Step 2: Run** `pnpm --filter @mentor/web exec vitest run coin-celebration` → FAIL.
- [ ] **Step 3: Implement** the helper (a `Set` of quiet reasons) and switch `economy-sync.tsx` on it: `COIN_TOAST` → `toast.success({ title: entry.title, message: t("quest_reward_coin", { count: entry.amount }), duration: 3000 })`; `CELEBRATION` → `notifyCoinCelebration(...)`; `XP_TOAST` → unchanged XP toast. A coin icon/visual in the toast is optional and must use existing components/tokens.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Checkpoint.**

### Task 7: Copy, fixed amounts and docs

**Files:**
- Modify: `apps/web/src/app/[locale]/_components/landing/landing-journey.tsx:11-53` (props + doc comment)
- Modify: `apps/web/messages/{tr,en}.json:373-377` (leaderboard preview `640/520/480 XP` → `6400/5200/4800 XP`)
- Modify: `docs/features/economy.md` (launch-rules table + timeline entry), `docs/features/ads.md` (timeline: reward default 10, daily limit 1, still off), `sinav-kocluk-roadmap.md:6-10` (header note amounts), `docs/core/deployment.md` (production override audit)

- [ ] **Step 1: Landing.** `xp(5)` → `xp(50)` (four daily rows), weekly XP `xp(20)` → `xp(200)`, `coin(15)` → `coin(100)`; doc comment amounts to +50 XP daily, +200 XP weekly, +250 XP milestone, +10 Coin per active day, +100 Coin weekly bonus. Keep "Coin is never said to buy anything".
- [ ] **Step 2: Docs.** economy.md table: profile/email 100 each; weekly effort = +10 Coin per active day + 100 bonus at 5; invite 200; AI chat / deep analysis 50 / 250; notebook 200; new row "Premium (incl. trial, STAFF, sponsored seat): XP only; chest pays 200 XP; onboarding and invite Coin still paid"; rewarded ads still disabled. Timeline entry `### 2026-11-01 — ×10 denomination, daily Coin, Premium earns XP` with what/usage/gotchas (`coinReward` by quest type, DB overrides beat defaults, dev balances look small, no backfill) and a link to the design. Roadmap header: replace 10/15/20/5/25 Coin amounts with the new ones and one line on Premium earning XP.
- [ ] **Step 3: Production audit (deployment.md),** added after the persisted-flags paragraph: before enabling the economy, in the attended operator session, list overrides with `select key, value from config_overrides where key like 'economy.%' or key like 'forum.xp.%' or key like 'ads.rewarded.%' order by key;`, delete every override of an amount/cost/cap key from the design's "New defaults" table (so the new default applies) or set the ×10 value, all in one session, then restart and verify effective values. Flags are not touched.
- [ ] **Step 4: Verify** `pnpm --filter @mentor/web exec vitest run` passes and `rg -n "\+15 Coin|15 = 3" apps docs` returns nothing outside history/timeline entries.
- [ ] **Step 5: Checkpoint.**

### Task 8: Whole-change verification

- [ ] **Step 1:** `pnpm lint`, `pnpm typecheck`, `pnpm --filter @mentor/api test`, `pnpm --filter @mentor/web test` → all green. A failure in a file this plan did not touch is reported by name as pre-existing with the reason it is unrelated; do not stash or reset the branch's other uncommitted work to prove it.
- [ ] **Step 2:** Local run (`pnpm dev`, local DB, `economy.enabled=true`, run the extended `apply-local-economy-launch.ts --apply`, restart API). As a free user: finish a focus session → quiet "+10 Coin" toast, quest row "+10 Coin", panel chest "x/5 gün · 100 Coin". As a Premium/trial user: no daily Coin row, chest shows "· 200 XP". Screenshot both panels.
- [ ] **Step 3:** Report to the owner: what changed, test results, screenshots, anything not verified. No commit.
