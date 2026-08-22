# Premium paywall and feature policy — Design

> Status: approved on 2026-08-22
> Scope: visible premium features, in-app paywall modal, admin-tunable free caps and plan catalog

## Product decision

The product stays a binary `FREE` / `PREMIUM` entitlement. There is no paid Standard tier.
Premium surfaces stay visible on every plan. A locked control opens a paywall modal instead of
navigating to `/abonelik`. `/abonelik` remains the account hub (status, cancel, legal).

Free users may receive a **capped** taste of a premium surface when that surface's
`free_enabled` flag is on. Exhausting the free cap returns `PAYMENT_PREMIUM_REQUIRED` and opens
the same modal. Premium users keep the existing fair-use caps (`AI_RATE_LIMITED` / photo monthly
limit) — those do not open the paywall.

Coin spend stays only on coach chat and deep analysis. New surfaces do not grow a coin path.

Admin-editable plan fields: `name`, `priceMinor`, `trialDays`, `isActive`. `id` and `periodMonths`
are immutable. Paywall headline, bullets, and CTA copy stay in i18n.

## Feature catalog

Stable ids (code-owned; admins cannot invent features):

| id | Window | Notes |
|---|---|---|
| `coach.chat` | day | Coin path remains after free cap |
| `photo.categorize` | month | Same photo counter as premium monthly cap |
| `plan.ai` | day | Shared quota for plan draft + adaptation |
| `mood.reflection` | day | |
| `ghost.narration` | day | |
| `vision.note` | day | |
| `session.reflection` | day | |
| `weekly.narration` | week | Coin unlock for deep analysis remains |
| `daily.greeting` | day | |
| `deep.analysis` | week | Coin path remains after free cap |

Defaults: every `free_enabled = false`, `free_limit = 1`. Launch tuning is admin config only.

This slice's web lock chrome covers the existing `/abonelik` upgrade CTAs plus photo/analysis AI.
Mood / ghost / greeting / session-reflection lock badges shipped the same day (visible lock →
paywall). The API still returns all ten policies.

## Access model

`EntitlementService.isPremium` is unchanged (STAFF, trial, active, grace, canceled-until-period-end).

Pure function `evaluateFeatureAccess({ isPremium, freeEnabled, used, freeLimit })`:

1. Premium → allowed (caller's existing premium cap still applies).
2. Free and `!freeEnabled` → deny `PAYMENT_PREMIUM_REQUIRED`.
3. Free, enabled, `used >= freeLimit` → deny `PAYMENT_PREMIUM_REQUIRED`.
4. Otherwise → allowed.

Chat and deep analysis then fall through to their existing coin paths when the function denies.

Payments must not read `ai_usage`. `GET /v1/subscription` therefore embeds **policy only**
(`freeEnabled`, `limit`, `window`) plus `entitlement`. The client treats a surface as unlocked when
`isPremium || freeEnabled`. Exhausted free quota is enforced on the action and surfaces as 403.

## Paywall UX

Dedicated overlay in `apps/web` (not `@mentor/ui` Dialog — that viewport is a 360px centered card).
Mobile: full-screen. Desktop (`lg:`): centered modal. DESIGN.md tokens only.

Flow: close → value headline → benefit list → plan cards from the catalog → consent (if purchase
enabled) → CTA → hosted checkout redirect to `/abonelik/sonuc`.

`sourceFeature` only selects an i18n headline variant. `PAYMENTS_PROVIDER=disabled` shows value
without a checkout CTA.

## Plan admin

`PATCH /v1/admin/plans/:id` (FINANCE, audited). Price changes apply to **new** checkouts only.
iyzico provider-plan sync is out of scope.

## Out of scope

- Second paid tier
- Per-feature CMS copy
- Restore Purchase
- iyzico price sync
- Remaining-quota on `GET /v1/subscription`
- Lock badges on mood / ghost / greeting / session reflection (shipped 2026-08-22)
