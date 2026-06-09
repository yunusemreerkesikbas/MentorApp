# 0008 — Base Infrastructure: Code-Review Fixes

> Date: 2026-06-08 · Scope: api / hardening · Related: devnote 0007, docs/standards/*

## What was done
Applied the agreed code-review remediations on the base layer (no critical issues were found):
- **Health excluded from the global filter:** `AllExceptionsFilter` passes through the terminus body for
  `…/health` `HttpException`s → up/down keep the same machine-readable shape; ApiError no longer leaks into probes.
- **Swagger prod-gated:** `setupSwagger` runs only when `NODE_ENV !== "production"`.
- **CORS env-driven:** `CORS_ORIGINS` (comma-separated) in env; falls back to dev defaults (web :3000, admin :3002).
- **Validation field messages localized:** Zod issue codes → `validation.<code>` (TR/EN); top message already localized.
- **Sentry `instrument.ts`:** new file imported first in `main.ts` (dotenv + `Sentry.init`) → correct
  auto-instrumentation order + local `.env` DSN works. `observability/sentry.ts` now only re-exports `Sentry`.
- **Negative-path e2e:** `errors.e2e-spec` (DomainError/validation/500 → ApiError, localized, no leak) +
  `health-down.e2e-spec` (DB unreachable → readiness 503, liveness 200).
- **Housekeeping:** i18n `watch` only in development; fixed the stale env-schema comment.

## Result
- Tests: **32 passing** (8 files); typecheck/lint/build green.

## How to use (usage)
- Prod build serves no `/v1/docs`. Set `CORS_ORIGINS` per environment.
- Validation errors return `details: [{ path, code, message }]` with a localized `message`.

## Gotchas / accepted (no change)
- FK violation (`23503`) → 409 CONFLICT for now; revisit per-endpoint (insert-bad-ref vs delete-restrict) when those routes exist.
- The Express-5 `/v1/*` path-to-regexp boot warning is non-fatal (auto-converted by Nest).
- e2e files mutate `process.env.DATABASE_URL` → vitest runs with `fileParallelism: false`.

## Related files
- `apps/api/src/common/filters/all-exceptions.filter.ts` · `main.ts` · `instrument.ts` · `observability/sentry.ts`
- `apps/api/src/config/env.validation.ts` · `i18n/{i18n.module.ts,locales/*/validation.json}`
- `apps/api/test/{errors,health-down}.e2e-spec.ts` · `.env.example` · `vitest.config.ts`
