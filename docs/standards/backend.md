# Backend Standards (NestJS · Drizzle · Neon)

> Canonical context: [`../../AGENTS.md`](../../AGENTS.md) · Architecture: [`../core/architecture.md`](../core/architecture.md).
> This list is **binding**; checked in PR review (see [code-review.md](./code-review.md)).

## Modules & layers
- [ ] A module stays in **its bounded context**; it **never touches** another module's tables → public
  service or **domain event** (`EventEmitter`).
- [ ] **Pragmatic Clean:** simple CRUD → `controller + service + repository`. Critical domain
  (economy/payments/ai/forum-verification) → `domain / application / infrastructure / presentation`.
- [ ] The domain layer **knows no framework** (doesn't import NestJS/Drizzle). Infrastructure is outermost,
  plugged in via a port.

## Modularity & file size limits (binding)
- [ ] **Proactive decomposition during development:** Do NOT allow backend services, controllers, or repositories to swell into monolithic God-classes (500+ lines). Decompose into focused sub-units *during development*, not as an afterthought.
- [ ] **Target threshold:** Individual service, controller, or repository files should stay under **250–300 lines**. When approaching or exceeding this threshold, split immediately into cohesive sub-units.
- [ ] **What to extract on backend:**
  - **Sub-services & domain services:** Specialized domain concerns (e.g. calculation engines, state transition managers, session completion processors).
  - **Strategy & handler classes:** Multiple branching workflows (e.g. payment providers, reward strategies, notification channels, event handlers) must be extracted into Strategy / Handler classes rather than massive switch/if-else blocks inside one service.
  - **Query builders & repository helpers:** Complex multi-table joins, aggregations, or filters belong in dedicated query objects, scopes, or sub-repositories.
  - **DTO & entity mappers:** Pure serialization, response transformation, and param mapping belong in dedicated mapper files, not inlined across controllers and services.
  - **Thin controllers:** Controllers remain strictly lean HTTP adapters (routing, DTO validation, calling services). No business logic or multi-step coordination in controllers.

## Data access
- [ ] DB is accessed **only via a repository** (controllers/services don't write raw SQL).
- [ ] **Single driver:** `pg` Pool (`drizzle-orm/node-postgres`). RLS-session work uses `withUserContext`
  (tx-scoped `SET LOCAL`). Works against local Postgres + Neon (dev/prod parity).
- [ ] Tenancy on every query: `user_id` / `org_id` filter **+** Postgres RLS (double belt). Don't rely on
  the app filter alone.
- [ ] Schema change → `drizzle-kit generate` migration (not handwritten SQL); migrations in version control.
- [ ] **Migrations are forward-only:** never edit an applied/shipped migration → add a new one.
- [ ] **`CHECK`/`FOREIGN KEY` on a non-empty table → `NOT VALID`, then `VALIDATE CONSTRAINT`.**
      A plain `ADD CONSTRAINT` takes an ACCESS EXCLUSIVE lock and full-scans the table to verify
      rows that a nullable new column usually satisfies anyway; `VALIDATE` takes only SHARE UPDATE
      EXCLUSIVE and lets reads/writes through. Matters most on the hot tables (`plan_tasks`,
      `study_sessions`, `daily_activity`). `drizzle-kit` does not emit `NOT VALID` — split it by
      hand into the generated file **before** the migration is applied anywhere.
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
- ❌ Direct cross-module table/repo access · ❌ business logic/SQL in controllers · ❌ monolithic bloated services/controllers (>250–300 lines without decomposition) · ❌ synchronous LLM calls ·
  ❌ raw `any` · ❌ schema change without a migration.
