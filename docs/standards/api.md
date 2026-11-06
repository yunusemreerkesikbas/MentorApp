# API Design & Versioning Standards + Service Catalog

> Canonical context: [`AGENTS.md`](../../AGENTS.md) · Backend: [`backend.md`](./backend.md).
> A single API (NestJS `/v1`) serves `apps/web`, `apps/admin`, and Phase 2 mobile → **versioned & backward-compatible** (§8).

---

## 1. Versioning & OpenAPI

- All routes live under the **`/v1`** prefix (`https://api.<domain>/v1`).
- **Additive policy:** Additive changes (new optional field or new endpoint) **never bump** the version. Breaking changes require `/v2` while keeping `/v1` alive for mobile compatibility.
- **Contract codegen:** OpenAPI spec (`/v1/docs` in dev, `pnpm --filter @mentor/api openapi:export`) drives `@mentor/api-client` (`pnpm --filter @mentor/api-client generate`). Never hand-write client endpoint contracts.

---

## 2. URL & Resource Naming

- **Plural, kebab-case nouns:** `/v1/study-sessions`, `/v1/info-articles`, `/v1/mock-exams`, `/v1/study-rooms`.
- **Shallow nesting:** `/v1/study-sessions/{id}`, `/v1/users/{id}/subscription`.
- **Sub-resource actions:** `POST /v1/mock-exams/{id}/analyze`, `POST /v1/plan-tasks/adapt`.
- **IDs & Query Params:** UUID path parameters; pagination (`?page=1&pageSize=20`, max `100`) and filters (`?examType=KPSS`) in query string.

---

## 3. HTTP Methods & Status Codes

| Case | Status Code |
|---|---|
| `GET` / `PATCH` / `POST` success | `200` |
| `POST` resource created | `201` |
| `DELETE` / `PUT` with no response body | `204` |
| Validation error (Zod) or invalid input | `400` |
| Unauthenticated / invalid token | `401` |
| Forbidden (role, entitlement, or feature gate) | `403` |
| Not found (or foreign/hidden resource) | `404` |
| State conflict / stale revision / idempotency mismatch | `409` |
| Business rule / unprocessable entity (e.g. invalid coupon) | `422` |
| Rate limit or daily/monthly quota exceeded | `429` |
| Feature/provider disabled or global budget cap reached | `503` |

---

## 4. Envelopes, Localization & Computation

- **Error Envelope:** Always `ApiError { code, message, details? }` (`@mentor/types`).
  - `code` is a stable machine identifier (`VALIDATION_ERROR`, `PAYMENT_PREMIUM_REQUIRED`, `AI_CHAT_QUOTA_EXCEEDED`).
  - `message` is **already localized** by the backend (`Accept-Language: tr | en`) following [`docs/copy/voice.md`](../copy/voice.md). Clients display `message` directly.
- **Paginated List Envelope:** `Paginated<T> { items, total, page, pageSize }`. No unbounded list endpoints.
- **Backend-Only Logic:** All business calculations (net scores, streaks, promotion discounts, XP/Coin balances, trial eligibility, readiness flags) happen on the server. Responses are returned ready to render.
- **Dates & Money:** UTC ISO-8601 strings (`2026-06-07T13:00:00Z`) and integer minor units (`priceMinor`, kuruş) — never floats.
- **Health Probes:** `/v1/health` and `/v1/health/ready` use the `@nestjs/terminus` shape for orchestrators and bypass the `ApiError` filter.

---

## 5. Security & Reliability Contracts

- **Auth:** `Authorization: Bearer <accessJWT>` (`sid`-bound; verified against active session/account state). Refresh tokens use `httpOnly` cookies (`/v1/auth/refresh` for web, `/v1/auth/admin/refresh` for admin) with transactional rotation and family revocation.
- **Idempotency:** Required `Idempotency-Key` UUID header on Coin/money mutations and provider webhooks.
- **Tenancy & RLS:** Guard/Policy + Postgres `FORCE ROW LEVEL SECURITY` (`withUserContext` / `withServiceContext`).
- **Uploads & Bounded Trial Media:** Feature endpoints issue one-use `/v1/storage/uploads/:ticket` capabilities (validated for session, owner, byte cap, and magic bytes). In bounded trial mode, media serves through session-verified `/v1/storage/media/private?grant=...` and `/v1/storage/media/public/*key`.

---

## 6. Service Catalog (`/v1` Bounded Contexts)

| Module | Key Route Prefixes | Core Responsibilities |
|---|---|---|
| **Public Availability** | `GET /v1/app/availability` | Anonymous `no-store` booleans (`aiCoach`, `social`, `forum`, `studyRooms`, `humanCoaching`, `studentPurchases`, `coachPurchases`, `studentSignup`, `coachSignup`, `coachRegistration`, `economy`, `invitations`). |
| **`identity`** (`W1`) | `/v1/auth/*`, `/v1/auth/admin/*`, `/v1/users/me/*`, `/v1/users/:username/{follow,followers,following}`, `/v1/waitlist` | JWT + refresh rotation, Google OAuth + explicit account linking, SMS OTP phone verification (`/v1/users/me/phone/*`), profile & avatar upload, one-way follow graph, KVKK export/erasure, invite-only waitlist gate (`APP-138`). |
| **`coaching`** (`W2`) | `/v1/coaching/{today,public/pulse,analysis,weekly-review,mood-checkins,vision}`, `/v1/coaching/weekly-recaps/*`, `/v1/plan-tasks/*`, `/v1/study-sessions/*`, `/v1/mock-exams/*`, `/v1/coaching/notebooks/*` | Daily ritual (`today` with `canLightenPlan`), weekly plan & atomic adaptation (`POST /v1/plan-tasks/adapt`), focus sessions (Pomodoro & `stopwatch`), mock exam net engine, photo-logged study notebooks (`MISTAKE` + `CUSTOM`, review ladder, `contents`), Weekly Recap (`Wrapped` + deep analysis + follow-up task), Vision Board & YKS preference simulation prototype. |
| **`ai`** (`W3`) | `/v1/coach/{access,chat,chat/stream,conversations/*,profile,memories/*,messages/:id/action}`, `/v1/coach/{daily-greeting,mood-reflection,plan-adaptation,plan-previews/*,weekly-review,ghost-narration,vision-note}`, `/v1/mock-exams/:id/categorize-photo` | Puhu AI companion (daily + monthly quota on `/v1/coach/access`), consent-based structured memory, traceable evidence snapshots, `Puhu’yla planla` (`plan-adaptation` for Premium, `plan-previews` for Coin), vision topic classification (never solves), verified official-info data cards, global monthly USD cap & provider kill-switch. |
| **`content`** (`W5a`) | `/v1/content/exams/*`, `/v1/content/info-articles/*`, `/v1/content/programs/search`, `/v1/content/universities/:id/campus-experience` | 5-exam catalog (`KPSS · YKS · LGS · ALES · DGS`, KPSS variants), subject/topic taxonomy, verified exam calendar, public SEO `/bilgi` articles, and official YKS program catalog. |
| **`payments`** (`W4`) | `/v1/plans`, `/v1/subscription/{,checkout,cancel,offers}`, `/v1/webhooks/payments`, `/v1/internal/cron/expire-subscriptions` | Subscription billing (`fake` / `iyzico`), `EntitlementService` + `PremiumGuard`, serialized paid/trial checkout reservations, phone-optional or phone-verified carded trials, purchase channel flags (`web` / `mobile` / `redirectToMobile`), append-only transaction ledger, natural-expiry cron sweeper. |
| **`promotions`** (`W4+`) | `POST /v1/subscription/offers`, `/v1/admin/promotions/*` | Single-winner discount engine (`ANYONE`, `NEW_USER`, `ACTIVE_DAYS`, `WIN_BACK`, `INVITED`), coded coupons & automatic offers, frozen redemption pricing (`charged + discount === list`), `previewByRule` for invite landings. |
| **`ads`** (`W4+`) | `/v1/ads/public/placements/:id`, `/v1/ads/placements/:id`, `/v1/ads/reward-offers/:id`, `/v1/ads/reward-sessions/*`, `/v1/admin/ads/*` | Google AdSense display placements (content-revision verified for public/community QA, announcements, and blog) and idempotent rewarded Coin sessions. Ad-free for Premium/STAFF. |
| **`notifications`** (`W5b`) | `/v1/notifications/*`, `/v1/internal/cron/{process-jobs,dispatch-daily-reminders}` | In-app notification center + SSE stream, `Resend` transactional emails, web push, admin announcements, payment dunning & win-back nudges. |
| **`admin`** (`W6`) | `/v1/admin/{users,coaches,plans,promotions,ads,content,forum,config,metrics,audit-log,waitlist}/*` | RBAC back-office (`SUPER_ADMIN`, `FINANCE`, `CONTENT_EDITOR`, `MODERATOR`, `SUPPORT`), append-only audit log, runtime `config_overrides`, KPI & sponsorship cost metrics, user/coach/waitlist management. |
| **`economy`** (`W7a`) | `/v1/economy/{balance,ledger,quests,uses,notebook-slots,deep-analysis,weekly-chest/*,rewards/*,invite,invite/redeem}` | Append-only `XP`/`Coin` ledger, daily/weekly/milestone quests, 12-level Night Journey, Weekly Chest (`PROGRESS`/`READY`/`OPENED`), Coin unlock catalog (`uses`, `notebook-slots`, `deep-analysis`), friend invite codes & conversion rewards with refund clawback. |
| **`forum`** (`W7b`) | `/v1/forum/{hub,feed,trends,tags,tag-suggestions,search,zones/*,threads/*,posts/*,polls/*}` | Exam-scoped Q&A and discussion zones, max-3 curated tags, helpful votes, polls, reactions, community-to-Puhu coach bridge (`coach-bridge`), and moderator tools. |
| **`community`** (`W7c`) | `/v1/community/{summary,leaderboard}`, `/v1/study-rooms/*`, `/v1/buddy/*` | Shared top-down study rooms (`LIBRARY`/`CAFE`/`HOME`, room codes `MASA-`), effort-only XP leagues (`today`/`weekly`/`all_time`), study buddy pairing & nudges. |
| **`mentorship`** (`W8`) | `/v1/mentorship/{overview,invite-code,students/*,templates/*,brief,followups/*,applications/*,invitations/*,my-coach/*}` | Human coach workspace: student roster & risk flags, 1–21 task batch assignment (`plan_tasks.coach_note`), AI homework suggestions & cohort/student briefs, weekly reports (preview/finalize/share), follow-up decisions, self-service coach registration, and sponsored student seats. |

> For detailed endpoint payloads, state machines, and edge cases, see the corresponding document in [`docs/features/`](../features/README.md).
