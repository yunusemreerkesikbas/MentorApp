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

| Case                          | Code                          |
| ----------------------------- | ----------------------------- |
| GET success                   | `200`                         |
| POST created                  | `201` (returns Location/`id`) |
| Success, no body (DELETE/PUT) | `204`                         |
| Validation error (Zod)        | `400`                         |
| No/invalid credentials        | `401` · no permission `403`   |
| Not found                     | `404`                         |
| Conflict / idempotency replay | `409`                         |
| Rate limit                    | `429`                         |
| Server                        | `500`                         |

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

| Module          | Base path (planned)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                    | Phase                                 | Status |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------ |
| `identity`      | `/v1/auth/{signup,login,google/status,google/start,google/callback,refresh,logout,verify-email,forgot-password,reset-password}`, `/v1/users/me`, `/v1/users/me/verification-email`, `/v1/users/me/avatar-upload-url`, `/v1/users/:username/follow` _(PUT/DELETE)_, `/v1/users/:username/{followers,following}` _(cursor lists; social follow graph, APP-022)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | own JWT + refresh rotation (httpOnly cookie), Google OAuth, roles, org-ready, RLS, profile avatar upload, **one-way public follow graph** (`user_follows`; emits `identity.user.followed` → in-app notif)                                                                                                                                                                                                                                         | MVP                                   | ✅     |
| `coaching`      | `/v1/coaching/today`, `/v1/coaching/analysis?examId=…` _(optional active-exam scope; normalized subject performance, latest-four evidence-aware nextFocus with focus trend/direction/localized message, latest-four photoSubjectSignals, ghost)_, `/v1/plan-tasks` _(list by `date` **or** inclusive `from`/`to` range — week view)_, `/v1/plan-tasks/calendar` _(distinct dates in range — datepicker dots)_, `/v1/study-sessions`, `/v1/mock-exams?examId=…` _(optional filter)_, `PUT /v1/mock-exams/:id` _(server-recomputed result)_, `DELETE /v1/mock-exams/:id` _(permanent owned-record delete)_, `/v1/coaching/mood-checkins`, `/v1/coaching/vision` _(hayal/hedef panosu — GET + upsert POST)_                                                                                                                            | daily loop + deneme analysis (server-computed net, personal trend, rule-based ghost) + rule-based mood + vision/goal board                                                                                                                                                                                                                                                                                                                        | MVP                                   | ✅     |
| `ai`            | `/v1/coach/access` · `/v1/coach/chat{,/stream}` · `/v1/coach/conversations{,/:id/messages,/:id/regenerate/stream}` · `/v1/coach/memory` _(legacy read/delete)_ · `/v1/coach/mood-reflection` · `/v1/coach/daily-greeting` · `/v1/coach/plan-draft` · `/v1/coach/ghost-narration` · `/v1/coach/vision-note` · `/v1/coach/photo-access` · `/v1/mock-exams/photo-upload-url` · `/v1/mock-exams/{id}/categorize-photo` · `/v1/admin/ai/reembed`                                                                                                                                                                                                                                                                                                                                                                                         | Multi-turn thread chat; deterministic verified official-info resolver/data cards; exact-article grounding; coin/premium access; photo→subject/topic categorize; mood/ghost/vision/session/weekly AI narration. General chat is not embedded and automatic cross-thread memory is disabled.                                                                                                                                                        | MVP                                   | 🟡     |
| `content`       | `/v1/content/exams`, `/v1/content/exams/by-type/:type/calendar`, `/v1/content/exams/:slug/calendar`, `/v1/content/exams/:slug/subjects`, `/v1/content/info-articles`, `/v1/content/info-articles/:slug` _(planned: pgvector RAG index)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | editorial exam calendar + subject taxonomy + knowledge-center articles                                                                                                                                                                                                                                                                                                                                                                            | MVP                                   | ✅     |
| `payments`      | `/v1/plans` _(public)_, `/v1/subscription/{,checkout,cancel}`, `/v1/webhooks/payments` _(signed)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | carded trial + auto-renew (PaymentsPort: fake/iyzico), entitlement (`PremiumGuard`), idempotent webhook, e-archive stub                                                                                                                                                                                                                                                                                                                           | MVP                                   | ✅     |
| `notifications` | `/v1/notifications/{push-subscriptions,preferences,session-return-reminder}`, `/v1/internal/cron/{process-jobs,dispatch-daily-reminders}` _(CRON_SECRET)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Postgres job queue + cron runner, Postmark email, web push, payment dunning + rule-based daily reminders + opt-in session return (~24h)                                                                                                                                                                                                                                                                                                           | MVP                                   | ✅     |
| `admin`         | `/v1/admin/{users…,users/:id/roles/:role,audit-log,config…,metrics,users/:id/economy…,users/:id/subscription{,/refund,/cancel},content/articles…,content/exams…}` _(fine sub-roles §9: SUPPORT/FINANCE/EDITOR/SUPER_ADMIN; ADMIN/SUPER_ADMIN umbrella)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | user mgmt + KVKK, append-only audit log, config registry + feature flags, economy adjust, content editor (articles + exam-calendar), subscription view + record-only refund + cancel, metrics KPI snapshot, **fine admin sub-roles (scoped @Roles + SUPER_ADMIN role assignment)**                                                                                                                                                                | MVP                                   | ✅     |
| `economy`       | `/v1/economy/{balance,ledger,invite,invite/redeem,quests}` _(self, flag-gated; ledger returns render-ready title/description; quests v2 returns category/period/reward/action/progress metadata)_ · `/v1/admin/users/:id/economy{,/adjust}` _(ADMIN; overview incl. quests)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | append-only XP/Coin ledger (balance=sum), capped reward engine, **invite→conversion→coin**, **onboarding + daily ritual + streak/effort milestone quests (auto-grant)**, **coin spend→AI chat** (via EconomyService.spend); admin manual adjust; weekly ritual quests pending                                                                                                                                                                     | MVP (light)                           | 🟡     |
| `forum`         | Existing zone/thread/post/moderation API + `/v1/forum/hub` · `/v1/forum/feed?scope=relevant\|following&sort=trending\|recent\|top` · `/v1/forum/tags` · `/v1/forum/zones/:slug/feed` · `/v1/forum/search` _(threads/tags/public-safe people, max 5 each; legacy QA fields additive)_ · `PATCH /v1/forum/{threads\|posts}/:id` · `PUT/DELETE /v1/forum/{threads\|posts}/:id/helpful-vote` · `/v1/admin/forum/{tags,featured-thread}` _(EDITOR, audited; featured GET/PUT returns `ForumFeaturedAdminView` with selected `thread` summary)_ · legacy `/v1/forum/feed/following` remains compatible _(flag `forum.enabled`)_ | Zone/membership/thread/post/moderation retained. Discovery V2 adds curated max-3 tags, positive QA helpful votes, time+interaction locked owner edits, featured fallback, N+1-free server ranking and versioned opaque cursors. Search consumes identity public service; never reads identity tables/PII. Tier-1 verification/coin/C-layer/presence = later | MVP + Discovery V2 | 🟡 |
| `community`     | `/v1/community/summary` _(self; streak + badges always, XP/level/leaderboard flag-gated on `economy.enabled`)_ · `/v1/community/leaderboard?window=today\|weekly\|all_time` _(self; windowed effort ranking for the full-page tabs; day/week = Europe/Istanbul)_ · `/v1/buddy` _(GET composed view)_ · `/v1/buddy/requests/:username` _(POST)_ · `/v1/buddy/requests/:id{,/accept}` _(POST accept / DELETE decline-cancel)_ · `/v1/buddy` _(DELETE end)_ · `/v1/buddy/nudge` _(POST, 4h cooldown → 429)_ · `/v1/buddy/study-invite` _(POST; birlikte çalışma daveti — nudge cooldown'unu paylaşır)_ · `/v1/buddy/suggestions` _(GET; aynı sınav-türü kohortundan eşleşmemiş aday listesi — /seans keşif)_ · GET `/v1/buddy` active view'a `partnerStudyingNow` (canlı presence) eklendi _(yol arkadaşı v1+keşif+presence, APP-022)_ | right-column **Emek Panosu** + full-page ranking: read-time XP effort leaderboard (exam-type cohort, effort-only — never net), derived positive badges + level. Pure aggregation — owns no tables, composes identity/coaching/forum/economy public services. rank-movement (▲▼) computed read-time (previous closed period, no snapshot/cron). Redis sorted-set + presence + mahalle + live room = Phase 2                                        | MVP (effort board) · Phase 2 (social) | 🟡     |
| `marketplace`   | `/v1/marketplace/*`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | coach discovery/commission/chat                                                                                                                                                                                                                                                                                                                                                                                                                   | Phase 3                               | ⛔     |
| (system)        | `/v1/health`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | liveness                                                                                                                                                                                                                                                                                                                                                                                                                                          | MVP                                   | ✅     |

> Content calendar responses add `nextEvent` and `daysUntilNextEvent` without changing existing
> fields; both are `null` when no verified event remains today or later.

> Content/admin catalog addition: `POST /v1/admin/content/articles/images/upload-url` is EDITOR+
> and returns a presigned JPEG/PNG/WebP cover/body upload contract (5 MB client/fake-storage cap).

> Adaptive planning catalog addition: `POST /v1/coach/plan-adaptation` returns a Premium,
> non-mutating seven-day MOVE/ADD preview; `POST /v1/plan-tasks/adapt` applies the user's selected
> changes atomically under an opaque `planRevision` guard. The AI endpoint never writes coaching
> tables, and the coaching endpoint never invokes the model. `POST /v1/coach/plan-draft` and
> `POST /v1/plan-tasks/bulk` remain available for backward compatibility; the current web flow uses
> the adaptation pair.

> Community → coach bridge catalog addition (2026-07-31):
> `GET /v1/forum/threads/:id/coach-bridge` returns only public-safe structural eligibility;
> `POST /v1/coach/chat{,/stream}` additively accepts `contextCommunityThreadId`, mutually exclusive
> with `conversationId`; `GET /v1/coach/conversations/:id/messages` additively returns nullable
> `origin` and `communitySource`. Admin forum tag create/update additively accepts nullable
> `coachIntent`. The feature is gated by `forum.coach_bridge.enabled` and sends no forum content or
> identity data to the model.

> Daily continuity catalog addition (2026-07-22): `GET /v1/coaching/today` remains the sole daily
> action contract and `DailyNextActionDto` is unchanged. `GET /v1/coaching/weekly-review` additively
> returns nullable `suggestedTask { title, subject }`; `GET /v1/admin/metrics` additively returns
> `coaching { activeUsers7d, repeatUsers7d, repeatRate7d }`. No endpoint was added. Legacy
> `POST /v1/coach/plan-draft` and `POST /v1/coach/ghost-narration` remain for backward compatibility;
> current web surfaces do not add new consumers.

> Weekly recap catalog addition (2026-07-26): no endpoint was added. `GET /v1/coaching/today`
> additively returns backend-computed nullable `weeklyRecapPeriod` including `status`, so clients
> can suppress `EMPTY` teasers without a second request; `GET /v1/coaching/weekly-review`
> additively returns `recap`, qualifying-session/completed-task evidence and taxonomy-verified
> aggregate `plan` data. Existing `status` and cached `POST /v1/coach/weekly-review` contracts
> remain available; `READY` now also includes the configured completed-plan-task threshold.

> Mentor Wrapped catalog addition (2026-07-27): no endpoint or migration was added.
> `GET /v1/coaching/weekly-review` additively returns `recap.weeklyTitle`,
> `rhythm.{longestSessionMinutes,longestActiveRun,days,subjectBreakdown}` and discriminated
> `highlights[]`. All selection, tie-breaking and localization happen in the API; clients only
> compose screens from these facts. Weekly titles are ephemeral recap labels, not badge inventory.
> The cached `POST /v1/coach/weekly-review` now uses prompt v4 and remains gate-compatible.
> `GET /v1/coaching/today.weeklyRecapPeriod` is resolved independently from the live countdown:
> after an official exam date passes, `countdown` may be `null` while the completed-week recap
> period remains available. The object also carries the backend-resolved `examId`; dashboard links
> must reuse it instead of resolving the current countdown calendar again.

> PARTIAL story unlock addition (2026-07-29): `GET /v1/coaching/weekly-review` additively returns
> `recap.nextStorySignals[]`, containing every missing `FOCUS_SESSION`, `PLAN_TASK`, and `MOCK_EXAM`
> channel in backend-selected display order with localized `title` and `message`. `READY` and `EMPTY`
> return an empty array. Nullable `recap.nextStorySignal` remains backward-compatible and mirrors the
> first item. Clients render the supplied copy and must not reproduce the selection policy.

> Mentor Wrapped V1.3 addition (2026-07-29): no endpoint or migration was added.
> `GET /v1/coaching/weekly-review` additively returns nullable
> `rhythm.focusTimeBand { id, label, focusMinutes, qualifyingSessionCount, message }` and
> `rhythm.peakFocusDay { date, focusMinutes, message }`. Both use qualifying sessions and
> Europe/Istanbul; the peak day is independent of the two-highlight cap. The cached
> `POST /v1/coach/weekly-review` keeps its response/gate contract but uses prompt v6 with an
> explicit aggregate evidence object instead of serializing the full review DTO.

> Status: ✅ live · 🟡 partially live (some slices shipped) · ⏳ coming in MVP · ⛔ later phase. A new endpoint → update this catalog + OpenAPI + the matching feature-doc timeline.

> **Health probes** (`/v1/health`, `/v1/health/ready`) use the **terminus** response shape
> (`{ status, info, error, details }`), not the `ApiError` envelope — they are infra for orchestrators,
> outside the API contract. The global filter passes them through unchanged.

- `GET /v1/coaching/today` also carries `focusGoal { goalMinutes, focusMinutesToday }` and `focusingNow` (anonymous aggregate count, null under the server-side visibility threshold) — APP-022.
- `GET /v1/coaching/weekly-review?examId={uuid}` — completed-week rule summary + recap status,
  effort/rhythm aggregates, taxonomy-verified focus and plan breakdowns, backend-selected
  highlights, nullable weekly title, focus-time band and peak-focus day (JWT, Free).
- `POST /v1/coach/weekly-review` — cached Premium/coin-unlocked narration + deterministic
  suggested task (JWT).
