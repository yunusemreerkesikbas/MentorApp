# Integrations — Connection Guide

> Locked providers per roadmap §7/§8. This document explains the **account + environment** wiring for
> each service. No real secret is kept here → values go into `.env` (template: [`.env.example`](../.env.example)).

| Service | Role | Env key(s) | Phase |
|---|---|---|---|
| **Neon** | Postgres + pgvector (DB) | `DATABASE_URL` | MVP |
| **Own JWT** | Auth (access/refresh) | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | MVP |
| **OpenAI** | AI text (GPT-5) | `OPENAI_API_KEY`, `AI_PROVIDER` | MVP |
| **Gemini** | AI vision (photo→categorize) | `GEMINI_API_KEY`, `GEMINI_MODEL`, `VISION_PROVIDER` | MVP (premium) |
| **iyzico** | Subscription/payments | `IYZICO_*` | MVP |
| **Cloudflare R2** | Object storage (mock-exam photos) | `R2_*`, `STORAGE_PROVIDER`, `R2_PUBLIC_BASE_URL` | MVP |
| **Cloudflare Turnstile** | Bot/Sybil | `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | MVP |
| **Postmark** | Transactional email | `POSTMARK_TOKEN` | MVP |
| **Sentry** | Error monitoring | `SENTRY_DSN` | MVP |
| **Render** | Hosting (PaaS) | — (dashboard) | MVP |
| **Redis** | Presence/leaderboard/cache/queue | (later) | **Phase 2** |

## Setup steps (summary)

### Neon (DB)
1. [neon.tech](https://neon.tech) → project (region: **EU / eu-central**, KVKK + adjacent to Neon §8).
2. Enable the `pgvector` extension (SQL: `create extension if not exists vector;`).
3. Pooled connection string → `DATABASE_URL`. Use branching DX for preview/dev branches.
4. `pnpm --filter @mentor/api db:generate && db:migrate`.

### OpenAI / Gemini (AI)
- OpenAI key → `OPENAI_API_KEY` (no-training API; KVKK transfer disclosure). Text provider finalized via
  Turkish eval (§8). `AI_PROVIDER=openai` in prod when chat LLM is live.
- Google AI Studio key → `GEMINI_API_KEY` (vision, rate-limit + premium). Photo categorize:
  `VISION_PROVIDER=gemini` + `GEMINI_MODEL` (default `gemini-2.0-flash`). Dev/test: `VISION_PROVIDER=fake`.
- Mock-exam photo uploads: `STORAGE_PROVIDER=r2` + `R2_*` in prod; `fake` uses in-memory
  `/v1/storage/fake-upload` (dev/test only).

### iyzico (payments)
1. **Company required** (at least sole proprietorship) + documents + legal web pages → application (§7, Phase 0).
2. Sandbox credentials → `IYZICO_*` (`IYZICO_BASE_URL=sandbox`).
3. Webhook must be **idempotent** (no double coin/subscription §8). Card data at iyzico (PCI not ours).

### Cloudflare (R2 + Turnstile + Access)
- R2 bucket (zero egress) → `R2_*`. Turnstile site (signup/forum) → secret + public site key.
- The admin panel sits behind **Cloudflare Access** (Zero Trust) (§9) — via the dashboard, not env.

### Postmark (email)
- Server token → `POSTMARK_TOKEN`. Verify SPF/DKIM/DMARC. (US → KVKK transfer disclosure §8.)

### Sentry
- Project (node + nextjs) → `SENTRY_DSN`.

### Render (hosting)
- Dockerized service, single region **Frankfurt/EU**. Env variables go into the Render dashboard.
- Cost shield (§8): Neon max-CU + budget alert + Cloudflare edge rate-limit.

> ⚠️ **Phase 0 prerequisites (pre-launch, §7):** company setup, iyzico application, legal web pages
> (distance-sales/privacy/refund/KVKK), accountant/legal sign-off.
