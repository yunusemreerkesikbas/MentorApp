# Base Infrastructure

> The shared foundation every module builds on: monorepo skeleton, DB, errors, i18n, logging, health,
> OpenAPI, security, tests. Module: `apps/api` root + `shared/**`. Cross-cutting (not a feature).
> Full rationale: roadmap §8 (Turkish).

## Overview

The non-feature substrate: how the app boots, how it talks to Postgres, how errors/locales/logging are
shaped, how the API surface is documented, and how tests run. Everything in `docs/features/*` assumes
this layer is in place. It was built first (before any workstream) and hardened in a review pass.

## Architecture (key decisions)

- **Single DB driver:** one `pg` Pool via `drizzle-orm/node-postgres` — works local (docker) and Neon.
  No dual-driver abstraction (dropped early — it added ceremony without value).
- **RLS via `SET LOCAL`:** `withUserContext` / `withServiceContext` open a tx and set `app.user_id` /
  `app.role` for the connection → Postgres RLS policies see it. Local `mentor` superuser **bypasses**
  RLS (verify RLS-sensitive paths on Neon/prod).
- **Errors:** `ApiError` + typed `error-code.ts` (module-prefixed: `AUTH_…`, `PAYMENT_…`, …). pg errors
  mapped (`23505`→CONFLICT, `22007/22008`→400) so nothing leaks as a generic 500.
- **i18n:** `nestjs-i18n`, TR/EN locale files under `i18n/locales/`. **Logic + messages live backend-only**
  (engineering-principles §4/§5); the API returns localized `message` + a stable `code`.
- **Validation:** Zod is the single source (`@mentor/validation`), shared FE+BE.
- **Health:** `GET /v1/health` (filtered — excludes noisy downstreams).
- **OpenAPI:** `/v1/docs` (Swagger prod-gated behind env). orval codegen → `@mentor/api-client`.
- **Security:** per-route throttling (`@Throttle`), CORS (env), Sentry instrumentation, Turnstile where
  signup/Sybil risk exists. Global `JwtAuthGuard` (+`@Public`), `RolesGuard` (+`@Roles`), `@CurrentUser`.

## Tutorials / Guides

```bash
pnpm install
cp .env.example apps/api/.env          # API secrets (JWT_ACCESS_SECRET ≥32 chars, etc.)
pnpm db:up                             # local Postgres 16 + pgvector (host port 5433)
pnpm --filter @mentor/api db:migrate   # apply migrations
pnpm dev                               # api:3001 · web:3000 · admin:3002
```

```bash
# Regenerate API client after endpoint/contract changes:
pnpm --filter @mentor/api openapi:export && pnpm --filter @mentor/api-client generate

# Run the full backend suite (needs the local Postgres):
pnpm db:up && pnpm --filter @mentor/api test
```

## API (foundation endpoints)

- `GET /v1/health` — liveness/readiness (`@Public`).
- `GET /v1/docs` — OpenAPI/Swagger (dev only; prod-gated).
- All feature endpoints under `/v1/*`, versioned, Zod-validated, `ApiError` envelope, `RequestUser.id` RLS.

## Geliştirmeler (timeline)

- **Project initialization** — Turborepo + pnpm monorepo skeleton (`apps/*` + `packages/*`), queue +
  RLS foundational decisions. *(Original devnote 0001.)*
- **Core/base infrastructure** — `db` (pg Pool)/errors/i18n/logging/security/OpenAPI/health/tests; the
  dual-driver was dropped in favor of a single `pg` Pool. *(0007.)*
- **Base review fixes** — health filter exclusion, Swagger prod-gate, CORS env, validation i18n,
  Sentry instrument, negative e2e. *(0008.)*
- **2026-09-05: Privacy-safe diagnostics and production startup locks** — HTTP logs allow only
  method/path (without query strings or upload capabilities), UUID request ID, status and duration.
  Application logs retain module context, stable error codes and error-frame fingerprints; arbitrary
  message text, headers, bodies, user identifiers and raw exception/provider payloads are discarded.
  Sentry receives scrubbed error events only, without automatic request/SQL tracing or breadcrumbs.
  Usage: correlate failures using the response `x-request-id` and safe error fingerprint; use structured
  error metadata for new diagnostics. Gotcha: legacy freeform log prose is intentionally omitted.
  Production now requires HTTPS `APP_URL`, explicit HTTPS `CORS_ORIGINS`, a Turnstile secret and
  `TURNSTILE_EXPECTED_HOSTNAME` matching the app host. The signup widget uses action `signup`;
  `TURNSTILE_VERIFY_TIMEOUT_MS` bounds provider verification (default 5000 ms), including response reads.
  Invalid/missing tokens, wrong hostname/action, HTTP errors and timeouts fail closed. Startup also
  inspects the runtime database role and rejects superuser, BYPASSRLS, CREATEROLE, ownership of application
  tables/schemas/database, and memberships that grant those privileges. Deploy with separate restricted
  runtime and migration-owner credentials; changing environment files alone does not provision roles.
  Local development/test without Turnstile continues working, and only production inspects DB roles.
  Validation: negative unit tests with in-memory log streams, mocked Siteverify and mocked DB queries;
  no remote services, role changes or migrations run during those tests. Related files:
  `apps/api/src/observability/*`, `instrument.ts`, `common/filters/all-exceptions.filter.ts`,
  `config/env*.ts`, `modules/identity/application/turnstile.service.ts`, `database/database-role-safety.ts`,
  `database/database.module.ts`, `.env.example`, `render.yaml`.
- **2026-09-05: Güvenlik tabanı, bağımlılıklar ve CI kapıları** — Web ve admin Next.js 16.3.4,
  React 19.2.8 tabanına alındı; admin Bootstrap görünümü korundu. Drizzle, Sentry, axios, multer ve
  alt bağımlılıklar güvenli sürümlere taşındı; üretim bağımlılık taraması bilinen açık olmadan geçti.
  CI artık yüksek önem düzeyinde üretim bağımlılığı taraması ve gitleaks sır taraması çalıştırıyor.
  `0102_security-hardening` migration'ı sunucu oturumları, Google link niyetleri, push teslimat claim'leri
  ve yükleme yetkilerini ekliyor ve RLS'yi ENABLE+FORCE yapıyor. OpenAPI export, DTO ile bağlanan eksik
  yol parametrelerini de geçerli sözleşmeye tamamlıyor. Kullanım: endpoint değişikliğinden sonra normal
  export+orval komutunu çalıştır. Gotcha: bağımlılık taramasının yeşil olması uygulama mantığının veya
  gerçek Cloudflare/Render/Neon ayarlarının güvenli olduğunu tek başına kanıtlamaz. Yayın öncesi dış
  ortam adımları için [security-release-checklist.md](./security-release-checklist.md) kullanılır.

## Gotchas / Known issues

- **Local RLS masking:** `mentor` DB user is superuser → RLS bypassed locally; always verify
  RLS-sensitive reads (admin drafts, public forum reads) on Neon/prod.
- **Throttling was once a no-op** (real bug, fixed): `ThrottlerModule` with an empty `throttlers:[]`
  silently disabled `@Throttle`. Fixed by a named `default` throttler so route overrides apply.
- **Windows e2e boot** can exceed 10s → vitest `hookTimeout: 30s`.
- **Migration journal discipline:** commit each migration **with its snapshot + a real timestamp**,
  forward-only, never edit an applied migration (a cross-track journal-ordering corruption hit twice —
  0006/0008/0013; reconciled in the mood devnote).
- **Known pre-existing failure (W1):** `health-down.e2e` boots with an unreachable DB, but
  `SubjectSeedService.onModuleInit` (content) eagerly queries → `app.init()` throws before readiness
  assertions run. Fix = make the seed boot-resilient (W1 backlog).

## Related

- [architecture.md](./architecture.md) · [repo-and-conventions.md](./repo-and-conventions.md)
- Standards: [backend.md](../standards/backend.md) · [api.md](../standards/api.md) · [engineering-principles.md](../standards/engineering-principles.md)
- Setup: [setup.md](./setup.md) · Integrations: [integrations.md](./integrations.md)
