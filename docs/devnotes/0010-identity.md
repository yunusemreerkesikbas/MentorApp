# 0010 — W0 · Identity (auth + RLS + web auth screens)

> Date: 2026-06-10 · Scope: api (identity module) + web (auth) + api-client · Related: roadmap §8/§9/§11, workstreams W0

## What was done
- **Schema (0001 migration):** `users` (roles `text[]`, org-ready, KVKK timestamp, status), `organizations` +
  `coach_students` (Phase-2-ready, unused), `refresh_tokens` (hash + family), `email_tokens`. **RLS ENABLE+FORCE**
  on users/refresh_tokens/email_tokens; policies allow self (`app.user_id`) or `app.role IN ('SERVICE','ADMIN')`.
  New `withServiceContext` helper for pre-auth flows.
- **Auth:** own JWT (access ~15m, `@nestjs/jwt`) + **opaque refresh** (256-bit, sha256 in DB) in an
  **httpOnly cookie** (path `/v1/auth`); **rotation + reuse detection** (replay → whole family revoked);
  argon2id hashing; login is **enumeration-safe** (same 401 + dummy-hash timing equalization);
  forgot-password always 200; reset revokes all sessions; KVKK consent required; Turnstile verified when
  the secret is set; per-route throttling on auth endpoints.
- **Guards (global):** `JwtAuthGuard` (+`@Public()`), `RolesGuard` (+`@Roles()`), `@CurrentUser()`.
  Health is `@Public`.
- **Endpoints:** signup/login/refresh/logout/verify-email/forgot-password/reset-password + `GET/PATCH /users/me`
  (minimal onboarding: displayName/examType/examDate).
- **Email:** flows complete; dev `LoggerEmailAdapter` logs the link (W5 swaps in Postmark via `EMAIL_PORT`).
- **api-client:** orval codegen activated — `pnpm --filter @mentor/api openapi:export` →
  `pnpm --filter @mentor/api-client generate`; fetch mutator with `credentials:'include'` + bearer + `ApiClientError`
  (carries the backend's localized message).
- **Web:** `(auth)` pages (giris/kayit/sifremi-unuttum/sifre-sifirla/eposta-dogrula), `AuthProvider`
  (access token in memory + silent refresh + scheduled re-refresh), guarded `(app)` group + `/panel`.
- **Tests:** 55 passing — unit (rotation/reuse/expiry, guards, hashing) + e2e (full lifecycle, reuse→family
  revoke, enumeration safety, RLS smoke). Vitest `globalSetup` migrates the test DB.

## How to use (usage)
```bash
pnpm db:up && pnpm --filter @mentor/api db:migrate
pnpm --filter @mentor/api dev      # Swagger: /v1/docs (auth uçları @Public)
pnpm --filter @mentor/web dev      # /kayit → /panel akışı; verify/reset linki api logunda
```
- New protected endpoints need nothing — the global guard applies; opt out with `@Public()`, restrict with `@Roles()`.
- Tenant-scoped queries: `withUserContext`; pre-auth/service paths: `withServiceContext` (only from auth-boundary services).

## Gotchas
- **Deviation:** Passport not used (roadmap said "Passport+argon2") — `@nestjs/jwt` + custom guard is leaner
  for a JWT-only flow; argon2 kept.
- Refresh cookie is scoped to `/v1/auth` — it never travels with normal API calls.
- **Known gap:** OpenAPI response/body schemas are weak (zod DTOs aren't introspected) → generated client
  types are loose; FE casts via `@mentor/types`. Follow-up: zod→OpenAPI enrichment, then regenerate.
- e2e boot can exceed 10s on Windows → vitest `hookTimeout: 30s`.
- `JWT_ACCESS_SECRET` is now required (≥32 chars); dev value lives in `apps/api/.env`.

## Related files & decisions
- `apps/api/src/modules/identity/**` · `common/auth/**` · `database/{schema,rls}.ts` · `drizzle/0001_*.sql`
- `packages/api-client/{orval.config.ts,src/http.ts}` · `apps/web/src/{lib/auth-context.tsx,app/(auth),app/(app)}`
