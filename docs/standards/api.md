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
| `identity` | `/v1/auth`, `/v1/users`, `/v1/orgs` | signup/login (JWT), role, org | MVP | ⏳ |
| `coaching` | `/v1/plans`, `/v1/study-sessions`, `/v1/mock-exams`, `/v1/check-ins` | plan, ritual/Pomodoro, mock analysis, ghost | MVP | ⏳ |
| `ai` | `/v1/coach` (chat/grounded) | Context Builder + LLM/RAG orchestration | MVP | ⏳ |
| `content` | `/v1/info-articles`, `/v1/calendar` | knowledge-center A-layer + pgvector RAG | MVP | ⏳ |
| `payments` | `/v1/subscription`, `/v1/webhooks/iyzico` | subscription/trial/refund, e-archive | MVP | ⏳ |
| `notifications` | `/v1/notifications` | web push + email, scheduled | MVP | ⏳ |
| `admin` | `/v1/admin/*` | content editor, users, refund, metrics, audit, flags | MVP | ⏳ |
| `economy` | `/v1/economy/*` | XP/Coin ledger, quests/invites | Phase 2 | ⛔ |
| `forum` | `/v1/forum/*` | zones, verification, C-layer | Phase 2 | ⛔ |
| `community` | `/v1/neighborhoods/*` | neighborhood, presence/leaderboard, live room | Phase 2 | ⛔ |
| `marketplace` | `/v1/marketplace/*` | coach discovery/commission/chat | Phase 3 | ⛔ |
| (system) | `/v1/health` | liveness | MVP | ✅ |

> Status: ✅ live · ⏳ coming in MVP · ⛔ later phase. A new endpoint → update this catalog + OpenAPI + a devnote.
