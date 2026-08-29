# Integrations — Connection Guide

> Locked providers per roadmap §7/§8. This document explains the **account + environment** wiring for
> each service. No real secret is kept here → values go into `.env` (template: [`.env.example`](../.env.example)).

| Service | Role | Env key(s) | Phase |
|---|---|---|---|
| **Neon** | Postgres + pgvector (DB) | `DATABASE_URL` | MVP |
| **Own JWT** | Auth (access/refresh) | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | MVP |
| **OpenAI** | AI text, embeddings + vision classification | `OPENAI_API_KEY`, `OPENAI_*_MODEL`, `AI_PROVIDER`, `VISION_PROVIDER` | MVP |
| **Gemini** | AI vision (photo→categorize) | `GEMINI_API_KEY`, `GEMINI_MODEL`, `VISION_PROVIDER` | MVP (premium) |
| **iyzico** | Subscription/payments | `IYZICO_*` | MVP |
| **Cloudflare R2** | Object storage — **two buckets**: public (avatars, forum ekleri, makale görselleri, vision board) + private (`mock-exams/`). Kurulum: [`storage-r2.md`](./storage-r2.md) | `STORAGE_PROVIDER`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BUCKET`, `R2_PRIVATE_BUCKET`, `R2_PUBLIC_BASE_URL`, `R2_JURISDICTION` | MVP |
| **Cloudflare Turnstile** | Bot/Sybil | `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | MVP |
| **Postmark** | Transactional email | `POSTMARK_TOKEN` | MVP |
| **Sentry** | Error monitoring | `SENTRY_DSN` | MVP |
| **Google Analytics / Search Console** | Consent-gated article analytics + ownership verification | `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | MVP |
| **Google Maps Platform** | Lazy photorealistic 3D campus tour | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | YKS beta |
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
  Turkish eval (§8). Production uses `AI_PROVIDER=openai`; `AI_PROVIDER=fake` fails boot. To pause AI,
  keep the real provider configured and disable the runtime `ai.enabled` flag.
- OpenAI live contract check: `pnpm --filter @mentor/api test:live:openai`. It reads `apps/api/.env`,
  makes four low-cost real calls (chat, stream, embedding, vision), and is never part of `pnpm test`.
- `OPENAI_EMBED_MODEL` must return 1536 finite dimensions. Changing `AI_PROVIDER`/embedding model
  requires one `POST /v1/admin/ai/reembed` run so stored and query vectors stay compatible.
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

### Google Analytics 4 / Search Console
- Set the public GA4 measurement ID only in deployments where analytics is enabled. The GA script is
  absent until the visitor explicitly accepts; withdrawal disables collection and clears GA cookies.
- Search Console verification is optional and is emitted through Next metadata. GA/consent copy must
  receive product-owner legal/KVKK review before production publication.

### Google Maps Platform (YKS campus beta)
- Enable billing and the Maps JavaScript API for a dedicated browser key. Restrict the key to the
  production/preview HTTP referrers and restrict its API scope; a public browser key without both
  restrictions is not rollout-ready.
- Configure a conservative daily quota plus Cloud Billing budget alerts before enabling
  `coaching.preference_simulation.enabled`. The feature has a 2D fallback, but quota exhaustion must
  still be observable.
- The `maps3d` library loads only on `/hedef/simulasyon`. Never move the loader into the app shell or
  `/hedef`, otherwise every Vision Board visit pays the Google/3D bundle cost.
- Verify Selçuk with the real restricted key on desktop and mobile. Persist
  `PHOTOREALISTIC`; if only terrain is usable, persist `TERRAIN_ONLY` with `HYBRID`. Leave the campus
  row disabled when coverage or any of the five official POI coordinates is unverified.

### Google Ad Manager (web v1)
- Ad unit paths: `GAM_KNOWLEDGE_ARTICLE_END_AD_UNIT` and
  `GAM_DASHBOARD_REWARDED_COIN_AD_UNIT`. Test and production units must be separate.
- Verify the production domain and publish the real network's `ads.txt`; do not ship a placeholder
  publisher id. Keep all `ads.*` flags off until this is complete.
- In **Admin → Global settings → Network settings**, turn off Programmatic limited ads. Block adult,
  gambling, dating, alcohol/tobacco, violent and other age-inappropriate categories; apply child
  treatment to LGS inventory.
- The web loads Google's limited-ads GPT URL only after backend eligibility. EEA/UK/Switzerland stays
  off until a compatible CMP and legal review exist. Update privacy/cookie/foreign-transfer copy
  before rollout; limited ads is not synonymous with “no data processing.”

### Render (hosting)
- Dockerized service, single region **Frankfurt/EU**. Env variables go into the Render dashboard.
- Cost shield (§8): Neon max-CU + budget alert + Cloudflare edge rate-limit.

> ⚠️ **Phase 0 prerequisites (pre-launch, §7):** company setup, iyzico application, legal web pages
> (distance-sales/privacy/refund/KVKK), accountant/legal sign-off.
