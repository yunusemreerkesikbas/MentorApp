# 0007 — Core / Base Infrastructure (apps/api)

> Date: 2026-06-08 · Scope: api / architecture · Related: roadmap §8, plan "Phase 1 · Step 1"

## What was done
- **DB:** single `pg` Pool (`drizzle-orm/node-postgres`) — `database/` module (global, graceful pool
  drain), `withUserContext` RLS helper (tx-scoped `SET LOCAL`). First migration: `vector` extension +
  `set_updated_at` trigger + `jobs` table.
- **Config:** `DATABASE_URL` now required (fail-fast).
- **Errors:** `DomainError` hierarchy + `AllExceptionsFilter` → always `ApiError { code, message, details? }`;
  pg-error mapper (generic, no constraint leak); unknown/SQL → 500 generic, full detail to logs/Sentry only.
- **Validation:** custom `ZodValidationPipe` + `createZodDto` (Zod single source, no fragile dep).
- **i18n:** nestjs-i18n, TR default + EN scaffold; `Accept-Language` resolver; messages resolved by error `code`.
- **Logging:** nestjs-pino (JSON), correlation `x-request-id`, secret/PII redaction.
- **Observability:** Sentry (no-op without DSN); 5xx captured by the filter.
- **Security/OpenAPI:** helmet + CORS + 1mb body limit; Swagger at `/v1/docs`.
- **Health:** terminus — `/v1/health` liveness; `/v1/health/ready` with DB ping (503 if DB down).
- **Tooling:** docker-compose (pgvector, host **5433**), Vitest (+SWC). Tests: 26 passing (unit + e2e). CI runs a Postgres service.

## How to use (usage)
```bash
pnpm db:up
pnpm --filter @mentor/api db:migrate
pnpm --filter @mentor/api dev            # http://localhost:3001/v1  (logs: | pino-pretty for local)
pnpm --filter @mentor/api test           # vitest unit + e2e (needs db:up)
```
- New endpoints: define a Zod DTO via `createZodDto`; throw `DomainError` subclasses; add error codes to
  `errors/error-code.ts` + locale files; tenant-scoped DB work goes through `withUserContext`.

## Gotchas
- **Decision change:** the documented neon-http **dual-driver was simplified to a single `pg` Pool** — the API
  is a persistent Render service (not edge), a pooled connection supports tx/RLS naturally, and it gives
  local-docker/Neon parity. (AGENTS §1, roadmap §8 RLS row, backend.md, architecture.md updated.)
- **pino-pretty transport hangs bootstrap on Windows** → we log JSON in all envs; pipe `| pino-pretty` for local.
- Local Postgres uses host port **5433** (5432 was taken). `apps/api/.env` + `.env.example` reflect this.
- Migrations are **not** auto-applied on boot (separate `db:migrate` step).
- terminus readiness failure surfaces as our `ApiError` (503 `SERVICE_UNAVAILABLE`) via the global filter.

## Related files & decisions
- `apps/api/src/{database,common,i18n,observability,health,config,main.ts,app.module.ts}`
- `docker-compose.yml` · `apps/api/vitest.config.ts` · `.github/workflows/ci.yml`
