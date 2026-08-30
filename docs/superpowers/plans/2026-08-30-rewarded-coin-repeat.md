# Rewarded Coin Repeat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Free user complete both daily rewarded ads consecutively while keeping banner and modal state accurate.

**Architecture:** Keep eligibility in the Ads backend and treat the offer endpoint as the source of truth after every completion. The rewarded component owns GPT slot lifecycle; the dashboard owns banner visibility and success toast presentation.

**Tech Stack:** Next.js 16, React 19, next-intl, GPT rewarded events, NestJS config registry, Playwright.

**Spec:** `docs/plans/2026-08-30-rewarded-coin-repeat-design.md`

## Global Constraints

- Cooldown default is exactly `0` seconds; daily limit remains `2` and reward remains `5` Coin.
- Every ad requires a separate click and reward session.
- Top-banner copy describes Coin tasks; the modal explicitly says it is an advertisement.
- Premium and STAFF remain ad-free.
- Only relevant Ads/web verification is run; this is not a release-readiness pass.

---

### Task 1: Reproduce consecutive-right state loss

**Files:**
- Modify/Test: `apps/web/e2e/ads.spec.ts`

**Interfaces:**
- Consumes: `GET /v1/ads/reward-offers/dashboard.rewarded.coin` and reward session endpoints.
- Produces: a regression scenario for two consecutive explicit rewarded completions.

- [ ] Make the reward-offer mock stateful: return two rights initially, one after the first completion and `DAILY_LIMIT_REACHED` after the second.
- [ ] Assert the first completion shows a success toast, keeps the banner with `5 Coin`, and prepares another CTA.
- [ ] Assert the second completion uses a distinct session and hides the banner.
- [ ] Run the single Playwright scenario and confirm it fails because the current row remains in its local success state.

### Task 2: Refresh the real offer and rebuild the GPT slot

**Files:**
- Modify: `apps/web/src/components/ads/rewarded-ad-offer.tsx`
- Modify: `apps/web/src/components/economy-quests-card.tsx`
- Modify: `apps/web/src/app/[locale]/(app)/dashboard/_components/panel-shell.tsx`

**Interfaces:**
- Produces: `onCompleted(rewardCoin: number)` and `onOfferChange(offer)` callbacks.

- [ ] Replace the manufactured `eligible:false` completion state with a refresh generation.
- [ ] Dispose the completed GPT slot/listeners before fetching and preparing the next offer.
- [ ] Show the success toast in `PanelShell`, refresh banner state, and keep the task row mounted.
- [ ] Render `DAILY_LIMIT_REACHED` as the passive completed state and keep organic quest progress untouched.
- [ ] Re-run the single regression scenario and confirm it passes.

### Task 3: Apply the approved visual and copy design

**Files:**
- Modify: `apps/web/src/components/top-banner.tsx`
- Modify: `apps/web/messages/tr.json`
- Modify: `apps/web/messages/en.json`

**Interfaces:**
- Consumes: total available Coin calculated from backend `rewardCoin` and `dailyRemaining`.

- [ ] Apply a token-based horizontal gradient and Coin icon without changing static positioning.
- [ ] Use `Günlük görevlerinde {count} Coin seni bekliyor.` and mirrored English copy.
- [ ] Change the transparent modal task title to `Kısa bir reklam izle` and add completion/toast copy.
- [ ] Keep close, keyboard, reduced-motion and single-line behavior.

### Task 4: Set cooldown default and document the decision

**Files:**
- Modify: `apps/api/src/common/config/config.catalog.ts`
- Modify: `docs/features/ads.md`
- Modify: `docs/features/economy.md`

**Interfaces:**
- Produces: catalog default `ads.rewarded.web.cooldown_seconds = 0` with the existing `0..86400` validation.

- [ ] Change the catalog default from `900` to `0`; existing admin DB overrides remain explicit and must be set to zero operationally.
- [ ] Record consecutive rights, toast/row behavior and banner copy in feature timelines.

### Task 5: Targeted verification

**Files:**
- Test: `apps/web/e2e/ads.spec.ts`
- Test: touched API/web files only.

- [ ] Run the Ads Playwright file on desktop and mobile Chromium.
- [ ] Run `@mentor/web` typecheck and the existing top-banner unit test.
- [ ] Run ESLint only for touched web files and the relevant Ads config/service test if the default affects it.
- [ ] Review the final diff without claiming workspace-wide build or CI status.
