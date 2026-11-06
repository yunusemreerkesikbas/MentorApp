# Economy — XP, Non-Monetary Coin, Weekly Chest & Invites (`modules/economy` · W7a)

> Append-only `XP` & `Coin` ledger, daily/weekly/milestone quests, Weekly Chest ("Masa lambası"),
> Coin feature unlocks (`UnlockChoice`), and friend invite (`PUHU-XXXXXXXX`) rewards.

---

## 1. Overview & Guardrails

`EconomyModule` powers student progression (`XP`) and earned feature access (`Coin`):

- **Hard Guardrails (`AGENTS.md` §4 #3 & #4):**
  1. **Coin is strictly non-monetary and capped:** Coin can never be purchased with money, cashed out, or called `"bakiye / ücret / satın al"` (use `"Coin"`, `"hak"`, `"Coin ile aç"`).
  2. **Never put Coin in the chat composer:** `/koc/sohbet` has no Coin counter or upsell banner inside the conversation zone.
  3. **Immutable Append-Only Ledger (`ledger_entries`):** Balances are computed as `SUM(amount)` over `CONFIRMED` rows. Rows are never updated or deleted; reversals append a compensating row and mark the source `REVERSED`.
  4. **Premium Earns XP, Not Coin (`2026-11-01`):** Active Premium subscribers (including trial, STAFF, and sponsored seats) earn `XP` from daily/weekly effort (`200 XP` weekly chest) instead of Coin, while keeping any previously earned Coin spendable.

---

## 2. Canonical Economy Table (`×10` Rebalance — `2026-11-01`)

| Surface | Unit & Amount | Rule & Cap |
|---|---|---|
| **Daily Active Day** (`daily.active-day`) | `+10 Coin` (Free only) | `>=1` completed focus session or done plan task on the UTC day |
| **Weekly Chest** (`weekly.effort-allowance`) | `+100 Coin` (Free) / `+200 XP` (Premium) | 5 active days in an ISO week; opened via the 5-lamp Night Desk chest (`/v1/economy/weekly-chest`) |
| **Onboarding Quests** | `+100 Coin` each | Complete profile (`onboarding.profile`) & verify email (`onboarding.verify-email`), once per account |
| **Daily / Weekly / Milestone Rituals** | `+50` / `+200` / `+250 XP` | Powers the 12-level Night Journey (`Civciv` → `Efsane`, `TIER_THRESHOLDS` in `@mentor/core`) |
| **Friend Invite Conversion** | `+200 Coin` to inviter | Paid on invitee's **first positive real-money charge** (trials, 0 TL, sponsors, and renewals never trigger; source payment refund claws back up to available balance). Skipped if either user is a `COACH` |
| **Spend: Puhu Chat Message** | `50 Coin` | Bounded by daily free-tier Coin chat allowance |
| **Spend: `Puhu’yla planla` Preview** | `200 Coin` | 1 per rolling 24h via `UnlockChoice` sheet (`/v1/coach/plan-previews`) |
| **Spend: Weekly Recap + Deep Analysis** | `250 Coin` | Opens both Story and Deep Analysis views for the completed week (`/v1/coach/weekly-recaps`, max 2 per rolling 30d) |
| **Spend: Permanent `+1` Notebook Slot** | `200 Coin` | Adds +1 custom notebook slot (`max 2` purchased slots default; survives `economy.enabled=false`) |
| **Spend: Streak Freeze** | `200 Coin` | Protects a 1-day break (`/v1/economy/streak-rescue`) |
| **Rolling Earning Caps** | `500 Coin` / 24h · `2000 Coin` / 7d | Central config `economy.coin.{daily_cap,weekly_cap,min_xp_for_coin}` |

---

## 3. Core Subsystems

### 3.1 Weekly Chest ("Masa Lambası", `/v1/economy/weekly-chest/*`)
- **States:** `PROGRESS` (shows 7-day lamp bar and rules) → `READY` (5/5 lamps lit; gold `"Hazır!"` badge + `WeeklyChestNotice` toast outside `/panel`) → `OPENED` (stamps `user_quest_progress.revealed_at` once and acknowledges the held reward receipt so `EconomySync` doesn't double-toast).
- **Carry-Over:** An unopened `READY` chest from the immediately preceding ISO week is held and presented first (`carriedOver: true`) until opened.

### 3.2 Friend Invite & `INVITED` Discount (`/davet`, `/v1/economy/invite*`)
- **Code Format:** `PUHU-` + 8 unambiguous characters (case-insensitive; redeemable within `economy.invite.redeem_window_days = 7` days of signup by a non-coach who has never paid).
- **Public Landing (`/davet/[code]`):** Calls `GET /v1/economy/invite/preview/:code` (`20/min`) to show the inviter's display name and any live automatic `INVITED` promotion discount (via `SubscriptionsService.previewInviteOffer`). Redeeming automatically pairs the two students (study-buddy request or mutual follow).

### 3.3 Reward Receipts & `EconomySync` (`/v1/economy/rewards/*`)
- Organic positive grants insert a self-scoped receipt (`0114`). `createRewardSync` (`apps/web/src/lib/reward-sync.ts`) polls/syncs unseen receipts, shows quiet toasts for daily Coin or full-screen celebrations for milestones, refreshes the nav Coin pill, and calls `POST /v1/economy/rewards/seen`.

---

## 4. API Surface

| Endpoint | Purpose |
|---|---|
| `GET /v1/economy/balance`, `GET /v1/economy/ledger` | Confirmed `XP`/`Coin` balance, level progress, and paginated ledger history |
| `GET /v1/economy/uses` | Unified catalog of Coin-unlockable features, live prices, and eligibility |
| `GET /v1/economy/quests` | Quest progress & auto-grant evaluation (includes `rewardPendingMessage` when cap-held) |
| `GET /v1/economy/weekly-chest`, `POST .../weekly-chest/open` | Weekly 5-lamp chest state, 7-day summary, and idempotent opening |
| `GET /v1/economy/rewards/unseen`, `POST .../rewards/seen` | Unread reward receipts for client toast/celebration sync |
| `GET\|POST /v1/economy/notebook-slots` | Quote and purchase permanent `+1` custom notebook slot (`Idempotency-Key`) |
| `GET\|POST /v1/economy/deep-analysis`, `GET\|POST .../streak-rescue` | Legacy/direct Coin unlock endpoints |
| `GET /v1/economy/invite`, `GET .../invite/preview/:code`, `POST .../invite/redeem` | Friend invite card, public landing preview, and code redemption |
| `GET\|POST /v1/admin/users/:id/economy*`, `GET /v1/admin/metrics/economy` | Admin manual ledger adjustment (audited) and faucet/sink telemetry |

---

## 5. Geliştirmeler (Condensed Milestone Timeline)

- **2026-11-01..04 — `×10` Economy Rebalance, Weekly Chest ("Masa Lambası") & Unified Report Unlock (`APP-133–APP-135`):** Rebalanced all XP/Coin amounts and level thresholds by `×10`, switched Premium effort rewards from Coin to XP, shipped backend + web Weekly Chest opening scene (`0138`), and unified Weekly Recap + Deep Analysis under a single `250 Coin` acquisition.
- **2026-10-31 — Coin Uses Catalog & Permanent Notebook Slots:** Added `GET /v1/economy/uses` and `GET/POST /v1/economy/notebook-slots` (`200 Coin` per extra custom notebook).
- **2026-10-25..26 — `PUHU-` Friend Invites, `/davet/[code]` Landing & `INVITED` Promotion Seam:** Replaced `MENTOR-` codes with `PUHU-`, built the public invite landing and `InviteSignalRegistry` seam with `PaymentsModule`/`PromotionsModule`, and enforced coach exclusion on invite rewards/discounts.
- **2026-09-17 — Action-Driven Grants, Job-Backed Payment Conversion & Unseen Receipts (`0114`):** Moved quest grants to action triggers, persisted first-positive-charge invite events through `JobQueuePort`, and added `rewards/unseen` + `rewards/seen`.
- **2026-07-16..20 — W6 Economy Foundation (`0023`, `APP-025`):** Shipped append-only `ledger_entries`, capped grant engine, `EconomyService.spend`, and refund clawback (`RefundEventsListener`).
