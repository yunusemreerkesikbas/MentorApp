# Deployment, Operations & Closed-Trial Runbook

> Render (`api`, `web`, `admin` + cron jobs) · Neon Postgres (`pgvector` + RLS) · Cloudflare (DNS, WAF, R2, Turnstile, Access).
> Related: [`docs/core/deferred-staging.md`](./deferred-staging.md), [`docs/core/security-release-checklist.md`](./security-release-checklist.md), [`docs/core/storage-r2.md`](./storage-r2.md).

---

## 1. Topology Overview

| Service | Host | URL / Port | Notes |
|---|---|---|---|
| `@mentor/api` | Render Web Service | `api.puhukoc.com` (`:3001` local) | NestJS `/v1` monolith; health check `GET /v1/health` |
| `@mentor/web` | Render Web Service | `puhukoc.com` (`:3000` local) | Next.js 16 B2C app (TR default, `/en` secondary) |
| `@mentor/admin` | Render Web Service | `admin.puhukoc.com` (`:3002` local) | Next.js 16 back-office; gated by Cloudflare Access + `STAFF` JWT |
| Postgres | Neon | Pooled / Direct URL | Postgres 16 + `pgvector` + Row-Level Security (`FORCE ROW LEVEL SECURITY`) |
| Object Storage | Cloudflare R2 | Private bucket | Presigned PUT/GET for avatars, notebook pages, and study assets |
| Email | Resend | HTTPS API | Transactional emails (`RESEND_API_KEY`; `EMAIL_PROVIDER=resend\|disabled\|console`) |

Blueprint definition: [`render.yaml`](../../render.yaml).

---

## 2. Render Cron Jobs (`/v1/internal/cron/*`)

All cron endpoints require the `x-cron-secret: <CRON_SECRET>` header (`CronSecretGuard`).

| Endpoint | Schedule (UTC) | Purpose |
|---|---|---|
| `POST /v1/internal/cron/run-jobs` | Every 5 min | Drains the Postgres `jobs` queue (`JobQueuePort`) |
| `POST /v1/internal/cron/streak-check` | Daily `00:05` | Evaluates daily streaks, consumes streak freezes, emits notifications |
| `POST /v1/internal/cron/weekly-summary` | Mondays `05:00` | Generates weekly coaching summaries & XP league rollovers |
| `POST /v1/internal/cron/expire-subscriptions` | Daily `03:30` | Sweeps naturally ended subscriptions to `EXPIRED` (`SUBSCRIPTION_EXPIRED`) |
| `POST /v1/internal/cron/retention-cleanup` | Daily `04:00` | Purges expired unverified accounts, detached trial claims, and orphan R2 objects |

---

## 3. Environment & Provider Modes (Zero-Cost / Closed-Trial Ready)

`apps/api` validates all environment variables at startup (`src/common/config/env.validation.ts`).
Production boot **forbids** `fake` or `console` adapters (`PAYMENTS_PROVIDER=fake`, `SMS_PROVIDER=console`, `EMAIL_PROVIDER=console` fail fast in `NODE_ENV=production`), while supporting explicit **`disabled`** modes so a closed pilot can run with zero external paid provider keys:

| Capability | Env Var | Allowed Prod Values | Closed-Trial Safe Mode |
|---|---|---|---|
| AI (Text & Vision) | `AI_PROVIDER` | `hybrid` \| `disabled` | `AI_PROVIDER=disabled` + config `ai.enabled=false` (returns `503 AI_DISABLED`; startup skips provider key requirement) |
| Payments | `PAYMENTS_PROVIDER` | `iyzico` \| `disabled` | `PAYMENTS_PROVIDER=disabled` + `payments.web.enabled=false` |
| Email | `EMAIL_PROVIDER` | `resend` \| `disabled` | `EMAIL_PROVIDER=resend` (free tier) or `disabled` |
| SMS OTP | `SMS_PROVIDER` | `netgsm` \| `disabled` | `SMS_PROVIDER=disabled` (while `payments.trial.phone_verification_required=false` and `mentorship.seats.sponsorship_enabled=false`) |
| Storage | `STORAGE_PROVIDER` | `r2` \| `disabled` | `STORAGE_PROVIDER=r2` with bounded trial caps (`storage.r2.*` config keys) |

---

## 4. Database Migrations in Production

Before deployment, require successful **full CI** for the release code tree. In GitHub Actions, run
**CI → Run workflow** on the release ref (`gh workflow run ci.yml --ref master`). A normal scoped PR
check is not a release certification. A full run on a PR may be reused only when its Git tree is
identical to the deployed merge commit. See [the CI policy](../features/ci.md).

1. Generate migrations locally: `pnpm --filter @mentor/api db:generate`.
2. **Zero-downtime constraint rule:** Never add a blocking table-rewrite `CHECK` or `FOREIGN KEY` in a single lock step on populated tables. Use `ADD CONSTRAINT ... NOT VALID` followed by `VALIDATE CONSTRAINT ...`.
3. Apply migrations before or during the API deploy step using `DIRECT_DATABASE_URL` (unpooled Neon connection):
   ```bash
   pnpm --filter @mentor/api db:migrate
   ```
4. Verify schema & RLS policies with `GET /v1/health`.

---

## 5. Closed-Trial & Launch Toggles (Admin Config)

Key runtime flags managed in `/config` (`config_overrides` table, no redeploy required):

- **Invite-only waitlist gate:** `identity.registration.invite_only` (`true` = new signups without a valid invite code join `/bekleme-listesi`; admin approves from `/waitlist`).
- **AI kill switch & budget:** `ai.enabled` (`true`/`false`), `ai.budget.monthly_cap_usd_cents`.
- **Social & Economy visibility:** `economy.enabled`, `community.study_rooms.enabled`, `ads.enabled`, `promotions.enabled`.
- **Purchase channels:** `payments.web.enabled`, `payments.mobile.enabled`, `payments.web.redirect_to_mobile`, `mentorship.seats.billing_enabled`.

---

## 6. Operational Milestones (Condensed Timeline)

- **2026-11-05 — Invite-only registration & waitlist gate (`APP-138`):** Added `identity.registration.invite_only` runtime flag, `/bekleme-listesi` public queue, and admin batch approval in `/waitlist`.
- **2026-10-31 — Bounded trial R2 storage:** Added runtime storage quotas (`storage.r2.monthly_upload_cap_bytes`, per-user upload limits) and `STORAGE_PROVIDER=disabled` fallback so closed pilots never exceed Cloudflare R2 free-tier limits.
- **2026-10-30 — Disabled-AI startup & core-trial social boundary:** Allowed `AI_PROVIDER=disabled` in production without dummy API keys (`GET /v1/content/availability` reports `aiCoach: false` so web hides AI entry points cleanly).
- **2026-10-29 — Closed-pilot admin & free Render migration runbook:** Verified zero-cost Render + Neon + Cloudflare deployment topology and non-interactive migration execution.
- **2026-07-20 — Render Blueprint & Security Hardening (`0026`):** Initial `render.yaml`, Helmet CSP, CORS strict origin list, `/v1/health` readiness probe, and `CronSecretGuard` jobs.
