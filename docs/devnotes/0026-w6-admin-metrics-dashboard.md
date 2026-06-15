# 0026 — W6 · Admin Metrics Dashboard (KPI snapshot)

> Date: 2026-06-15 · Scope: api (admin + identity + payments + economy) + admin UI · Related: roadmap §9,
> workstreams W6, AGENTS §4. Closes the last W6 functional slice (after 0023/0024/0025).

## What was done
- **Read-only KPI snapshot** on the admin home (`/`): users · subscriptions/revenue · economy. Aggregates
  each module's **public stats service** (workstreams §3 — admin never queries other modules' tables).
  No mutation → **no audit**; ADMIN-only. Cross-tenant aggregates run in **SERVICE context**.
- **identity (additive):** `UsersRepository.statsSnapshot()` (single-scan `count(*) filter` — total, new
  7g/30g, verified, byStatus, byExamType) + `UsersService.getUserStats()` (`UserStats`). IdentityModule
  already exported `UsersService`.
- **payments (additive):** `SubscriptionsRepository.countByStatus()`; `PaymentEventsRepository.sumRenewalSince`
  / `sumRefundedSince` / `countPayingSubscriptions` (SERVICE); `SubscriptionsService.getSubscriptionStats()`
  (`SubscriptionStats`: status counts + `revenueMinor30d` + `refundedMinor` 30g + `conversionRate`).
- **economy (additive):** `LedgerRepository.sumIssued(unit, since?)` (Σ positive CONFIRMED) +
  `EconomyService.getEconomyStats()`; `InviteRepository.conversionStatsGlobal()` + `InviteService.getGlobalStats()`.
- **admin:** `AdminMetricsController` `GET /admin/metrics` (`@Roles(ADMIN)`, no audit) — `Promise.all` of the
  four stats calls → `{ users, subscriptions, economy{…,invite}, generatedAt }`. Registered in `admin.module`
  (Identity/Payments/Economy already imported → no new module deps).
- **Admin UI (TS):** `MetricsCards.tsx` (ADMIN-gated via `useAuth`) fetches `/admin/metrics`, renders KPI
  cards in 3 groups (Duralux card style). Money formatted `(*Minor/100) ₺`. Rendered above `HomeCards` on `/`.

## How to use (usage)
```bash
# ADMIN: open "/" → KPI snapshot (total users, active subs, 30g revenue ₺, conversion %, coin/XP, invites).
# API: GET /v1/admin/metrics  (ADMIN; 403 otherwise)
```

## Gotchas
- **Read-only, no audit** (consistent with economy/subscription GETs). `@Roles(ADMIN)` only.
- **SERVICE context:** every aggregate is cross-tenant → `withServiceContext`. Local `mentor` superuser
  bypasses RLS — verify counts on Neon/prod. **No migration** (read-only queries; reuses indexed columns).
- **Money minor-units:** API returns `*Minor` (kuruş); FE only formats — no FE calculation, no float.
- **"Conversion" is honest, not a full funnel:** `conversionRate = payingSubscriptions / totalSubscriptions`
  (subs with ≥1 SUCCEEDED RENEWAL). No subscription-history table → not a true trial→paid funnel; the KPI
  card is labelled "Ödemeye dönüşüm" accordingly.
- **MRR label = last-30-day successful renewals** (not annualized/normalized). Simple revenue snapshot.
- **LLM-cost & coaching engagement intentionally excluded** — no AI module/data yet; coaching services
  aren't exported. Both = backlog.
- **Perf:** on-demand SQL per request (no cache) — fine for low admin traffic; `count(*) filter` single scans.

## Related files & decisions
- `apps/api/src/modules/admin/presentation/admin-metrics.controller.ts` · `admin.module.ts`
- `apps/api/src/modules/identity/{application/users.service.ts, infrastructure/users.repository.ts}`
- `apps/api/src/modules/payments/{application/subscriptions.service.ts, infrastructure/payments.repositories.ts}`
- `apps/api/src/modules/economy/{application/economy.service.ts, application/invite.service.ts, infrastructure/ledger.repository.ts, infrastructure/invite.repository.ts}`
- `apps/admin/src/app/{MetricsCards.tsx, page.tsx}` · `lib/types.ts` (`AdminMetrics`)
- **Verified:** e2e 2 (403 non-admin; ADMIN snapshot — users.total≥3, active sub≥1, revenueMinor30d≥charge,
  conversion>0, economy shape); api lint+typecheck, admin typecheck+build green.
- Decisions (owner): scope = users + subscriptions/revenue + economy (no coaching); numeric KPI cards only;
  home "/" placement.

## Backlog
- Coaching engagement (DAU/sessions/mock-exams/mood) — needs a coaching stats service + SERVICE repo methods.
- Time-series trend charts (apexcharts available). · Selectable date range. · LLM cost (W3). · Result caching.
