# Backend Standards (NestJS · Drizzle · Neon)

> Canonical context: [`../../AGENTS.md`](../../AGENTS.md) · Architecture: [`../architecture.md`](../architecture.md).
> This list is **binding**; checked in PR review (see [code-review.md](./code-review.md)).

## Modules & layers
- [ ] A module stays in **its bounded context**; it **never touches** another module's tables → public
  service or **domain event** (`EventEmitter`).
- [ ] **Pragmatic Clean:** simple CRUD → `controller + service + repository`. Critical domain
  (economy/payments/ai/forum-verification) → `domain / application / infrastructure / presentation`.
- [ ] The domain layer **knows no framework** (doesn't import NestJS/Drizzle). Infrastructure is outermost,
  plugged in via a port.

## Data access
- [ ] DB is accessed **only via a repository** (controllers/services don't write raw SQL).
- [ ] **Dual-driver rule:** queries needing RLS-session + writes → `createDbPool` (tx-scoped). Simple
  reads → `createDb` (neon-http).
- [ ] Tenancy on every query: `user_id` / `org_id` filter **+** Postgres RLS (double belt). Don't rely on
  the app filter alone.
- [ ] Schema change → `drizzle-kit generate` migration (not handwritten SQL); migrations in version control.
- [ ] **Migrations are forward-only:** never edit an applied/shipped migration → add a new one.
- [ ] **List endpoints must be paginated** (`paginationQuerySchema`). No unbounded `findAll`.
- [ ] No N+1: fetch related data in one query/`inArray`; index frequently-filtered columns.

## API contract
- [ ] All routes under `/v1`, **backward-compatible** (mobile can't be force-updated). Breaking change →
  new field/new version.
- [ ] Input validation with **Zod** (`@mentor/validation`), at the request boundary. Don't use class-validator.
- [ ] Error response is the single shape `ApiError { code, message, details? }`; correct HTTP code.
- [ ] OpenAPI is generated → `@mentor/api-client` codegen; no handwritten endpoint contract.

## Async & reliability
- [ ] Heavy/slow work (LLM, email, embedding, report) goes to the **`JobQueuePort`**; don't block the request.
- [ ] Queue handlers are **idempotent** (assume at-least-once delivery).
- [ ] Money/coin flow: **append-only ledger** (never a single number, never delete), **idempotency**
  (iyzico webhook), **outbox** (publish events within the tx).

## Security
- [ ] AuthZ in a single place (**Guard/Policy**) + RLS. Never trust the client.
- [ ] Secrets only via env (`@nestjs/config` + Zod validation). Don't log secrets/PII.
- [ ] **PII-free summary** to the LLM (§4); official info isn't LLM-generated; photo categorizes-not-solves.
- [ ] Rate-limit at the Cloudflare edge + cost caps in config (§7).
- [ ] **Never expose raw SQL/DB/internal error messages or stack traces to the client.** Map to a generic,
  localized `ApiError` (`message` + `code`); log the full detail server-side (Sentry + structured log). Leaking
  internals is an info-disclosure risk and breaks the §0 calm tone.

## Observability & testing
- [ ] Errors to Sentry; **structured logs with a correlation/request id**; never log PII/secrets.
- [ ] Phased/risky features behind a **config-registry feature flag** (gradual rollout + kill-switch).
- [ ] Unit tests: domain/use-case pure logic. Integration: repository + adapter. E2E: auth + payment
  webhook idempotency.
- [ ] No merge unless `pnpm typecheck && lint && build` is green.

## Don't
- ❌ Direct cross-module table/repo access · ❌ business logic/SQL in controllers · ❌ synchronous LLM calls ·
  ❌ raw `any` · ❌ schema change without a migration.
