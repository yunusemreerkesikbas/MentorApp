# API Design & Versioning Standards + Service Catalog

> Canonical context: [`../../AGENTS.md`](../../AGENTS.md) · Backend: [backend.md](./backend.md).
> A single API (NestJS) serves web + (Phase 2) mobile + panel → **versioned & backward-compatible** (§8).

## 1. Versioning
- All routes under the **`/v1`** prefix. Base: `https://api.<domain>/v1`.
- **Policy:** additive changes (new field/endpoint) **don't bump** the version. A breaking change (removing a
  field/changing meaning) → new version `/v2`; `/v1` is **kept** for a while (mobile can't be force-updated).
- Never remove a required field from a response; carry a "deprecated" field for one cycle, then drop it in `/v2`.
- An OpenAPI spec is generated (`/v1/docs` Swagger) → `@mentor/api-client` orval codegen. No handwritten contract.

## 2. URL & resource naming
- **Plural, kebab-case nouns:** `/v1/study-sessions`, `/v1/info-articles`, `/v1/mock-exams`.
- Resource-centric; shallow nesting: `/v1/study-sessions/{id}`, `/v1/users/{id}/subscription`.
- If an action is needed, sub-resource/verb suffix: `POST /v1/mock-exams/{id}/analyze`.
- ID = uuid. Path param `{id}`; filtering/pagination in the query.

## 3. HTTP methods & status codes
| Case | Code |
|---|---|
| GET success | `200` |
| POST created | `201` (returns Location/`id`) |
| Success, no body (DELETE/PUT) | `204` |
| Validation error (Zod) | `400` |
| No/invalid credentials | `401` · no permission `403` |
| Not found | `404` |
| Conflict / idempotency replay | `409` |
| Rate limit | `429` |
| Server | `500` |

## 4. Envelopes & contracts
- **Error:** always `ApiError { code, message, details? }` (`@mentor/types`). `code` is machine-readable
  (`VALIDATION_ERROR`, `INSUFFICIENT_COIN`).
- **List:** `Paginated<T> { items, total, page, pageSize }`.
- **Pagination:** `?page=1&pageSize=20` (`paginationQuerySchema`, max 100). **No unbounded list.**
- **Sorting:** `?sort=field:asc|desc` (whitelisted fields). **Filtering:** explicit query params (`?examType=KPSS`).
- **Dates:** ISO 8601 UTC (`2026-06-07T13:00:00Z`). **Money:** string + minor unit/`numeric` (no float).

## 4b. Messages & localization
- **All business logic & calculations are server-side**; responses are **computed and ready to render**
  (FE/mobile never recompute — single brain for web+mobile, §engineering-principles).
- User-facing messages are returned **already localized** (per `Accept-Language`) as a human `message` **+**
  a stable machine `code` (in `ApiError` and in success payloads where relevant). Clients display `message`
  directly; `code` is for client-side branching, not for client-built copy.
- Validation errors (Zod) are mapped to localized `message` + `code` at the boundary.

## 5. Security & reliability
- **Auth:** `Authorization: Bearer <accessJWT>`; refresh rotation on a separate endpoint. Short-lived access.
- **Idempotency:** `Idempotency-Key` header on money/coin POSTs; idempotent webhook (no double processing).
- Input validated with Zod (at the boundary). Rate-limit at the Cloudflare edge + cost cap (§7).
- AuthZ Guard/Policy + RLS (double belt); tenancy `user_id`/`org_id`.

## 6. Service (module) catalog
> Source: [`apps/api/src/modules/README.md`](../../apps/api/src/modules/README.md). Base paths are planned;
> they appear in OpenAPI once a module is implemented.

| Module | Base path (planned) | Responsibility | Phase | Status |
|---|---|---|---|---|
| `identity` | `/v1/auth/{signup,login,google/status,google/start,google/callback,refresh,logout,verify-email,forgot-password,reset-password}`, `/v1/users/me`, `/v1/users/me/verification-email`, `/v1/users/me/avatar-upload-url` | own JWT + refresh rotation (httpOnly cookie), Google OAuth, roles, org-ready, RLS, profile avatar upload | MVP | ✅ |
| `coaching` | `/v1/coaching/today`, `/v1/coaching/analysis` *(+ `photoSubjectSignals`, `ghost` geçmiş-ben comparison)*, `/v1/plan-tasks` *(list by `date` **or** inclusive `from`/`to` range — week view)*, `/v1/plan-tasks/calendar` *(distinct dates in range — datepicker dots)*, `/v1/study-sessions`, `/v1/mock-exams`, `/v1/coaching/mood-checkins`, `/v1/coaching/vision` *(hayal/hedef panosu — GET + upsert POST)* | daily loop + deneme analysis (server-computed net, personal trend, rule-based ghost) + rule-based mood + vision/goal board | MVP | ✅ |
| `ai` | `/v1/coach/access` · `/v1/coach/chat` · `/v1/coach/mood-reflection` *(premium AI-adaptive mood reply; cached per day)* · `/v1/coach/ghost-narration` *(premium geçmiş-ben AI narration; cached per attempt)* · `/v1/coach/vision-note` *(premium hayal/hedef panosu AI motivation note; cached)* · `/v1/coach/photo-access` · `/v1/mock-exams/photo-upload-url` · `/v1/mock-exams/{id}/categorize-photo` *(premium vision; `ai.photo.monthly_limit`)* · `/v1/admin/ai/reembed` *(SUPER_ADMIN)* _(planned: multi-turn)_ | AI coach chat with **RAG grounding** + **coin→AI spend** + **photo→subject categorize** (Gemini/fake vision, fake/R2 storage) + **mood AI-adaptive reflection + mood grounding** + **ghost AI narration**; premium flat + rate limits | MVP | 🟡 |
| `content` | `/v1/content/exams`, `/v1/content/exams/by-type/:type/calendar`, `/v1/content/exams/:slug/calendar`, `/v1/content/exams/:slug/subjects`, `/v1/content/info-articles`, `/v1/content/info-articles/:slug` _(planned: pgvector RAG index)_ | editorial exam calendar + subject taxonomy + knowledge-center articles | MVP | ✅ |
| `payments` | `/v1/plans` *(public)*, `/v1/subscription/{,checkout,cancel}`, `/v1/webhooks/payments` *(signed)* | carded trial + auto-renew (PaymentsPort: fake/iyzico), entitlement (`PremiumGuard`), idempotent webhook, e-archive stub | MVP | ✅ |
| `notifications` | `/v1/notifications/{push-subscriptions,preferences}`, `/v1/internal/cron/{process-jobs,dispatch-daily-reminders}` *(CRON_SECRET)* | Postgres job queue + cron runner, Postmark email, web push, payment dunning + rule-based daily reminders | MVP | ✅ |
| `admin` | `/v1/admin/{users…,users/:id/roles/:role,audit-log,config…,metrics,users/:id/economy…,users/:id/subscription{,/refund,/cancel},content/articles…,content/exams…}` *(fine sub-roles §9: SUPPORT/FINANCE/EDITOR/SUPER_ADMIN; ADMIN/SUPER_ADMIN umbrella)* | user mgmt + KVKK, append-only audit log, config registry + feature flags, economy adjust, content editor (articles + exam-calendar), subscription view + record-only refund + cancel, metrics KPI snapshot, **fine admin sub-roles (scoped @Roles + SUPER_ADMIN role assignment)** | MVP | ✅ |
| `economy` | `/v1/economy/{balance,ledger,invite,invite/redeem,quests}` *(self, flag-gated; ledger returns render-ready title/description; quests v2 returns category/period/reward/action/progress metadata)* · `/v1/admin/users/:id/economy{,/adjust}` *(ADMIN; overview incl. quests)* | append-only XP/Coin ledger (balance=sum), capped reward engine, **invite→conversion→coin**, **onboarding + daily ritual + streak/effort milestone quests (auto-grant)**, **coin spend→AI chat** (via EconomyService.spend); admin manual adjust; weekly ritual quests pending | MVP (light) | 🟡 |
| `forum` | `/v1/forum/zones` *(list/create)* · `/v1/forum/zones/:slug` · `/v1/forum/zones/:id/{owner,join,members,members/:userId/approve,threads,reports}` · `/v1/forum/threads/:threadId` *(get detail/delete)* · `/v1/forum/threads/:threadId/{pin,reactions,answers,accept/:postId,restore}` · `/v1/forum/answers/:postId{,/restore}` · `/v1/forum/attachments/upload-url` *(presigned image upload; posts carry `attachments[]`, APP-018)* · `/v1/forum/search` · `/v1/forum/reports{,/:id/resolve}` *(flag `forum.enabled`)* | Zone + membership (s1). **s2:** flat feed + reactions + pin + **image attachments** (max 4, `forum_attachments`). **s3:** QA questions/answers + one-shot accept → `forum.answer.accepted` → XP; full-text search. **s5:** reports → moderation queue (room owner/mod + platform staff), HIDE (=soft-delete) / RESTORE / DISMISS + append-only `forum_moderation_actions` audit. Tier-1 auto-detect + verification/coin/C-layer = later / Phase 2 | MVP (slice 1–3,5) | 🟡 |
| `community` | `/v1/community/summary` *(self; streak + badges always, XP/level/leaderboard flag-gated on `economy.enabled`)* · `/v1/community/leaderboard?window=today\|weekly\|all_time` *(self; windowed effort ranking for the full-page tabs; day/week = Europe/Istanbul)* | right-column **Emek Panosu** + full-page ranking: read-time XP effort leaderboard (exam-type cohort, effort-only — never net), derived positive badges + level. Pure aggregation — owns no tables, composes identity/coaching/forum/economy public services. rank-movement (▲▼) computed read-time (previous closed period, no snapshot/cron). Redis sorted-set + presence + mahalle + live room = Phase 2 | MVP (effort board) · Phase 2 (social) | 🟡 |
| `marketplace` | `/v1/marketplace/*` | coach discovery/commission/chat | Phase 3 | ⛔ |
| (system) | `/v1/health` | liveness | MVP | ✅ |

> Status: ✅ live · 🟡 partially live (some slices shipped) · ⏳ coming in MVP · ⛔ later phase. A new endpoint → update this catalog + OpenAPI + the matching feature-doc timeline.

> **Health probes** (`/v1/health`, `/v1/health/ready`) use the **terminus** response shape
> (`{ status, info, error, details }`), not the `ApiError` envelope — they are infra for orchestrators,
> outside the API contract. The global filter passes them through unchanged.
