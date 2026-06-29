# Identity

> Auth (own JWT + refresh rotation + RLS), user onboarding, KVKK consent, web auth screens.
> Module: `modules/identity`. Workstream: W0 (foundation — everything depends on this).

## Overview

Identity is the foundation module. It owns the `users` table (roles `text[]`, org-ready, KVKK
timestamps, status), the auth lifecycle (signup/login/refresh/logout/verify-email/forgot-password/
reset-password), `GET/PATCH /users/me` (minimal onboarding), the global JwtAuthGuard + RolesGuard,
and the RLS context helpers (`withUserContext` / `withServiceContext`) every other module relies on.
It also exports `UsersService` (consumed by coaching for `examType`, by notifications for contact,
by admin for stats) — the canonical cross-module seam for user data.

## Architecture (key decisions)

- **Own JWT** (access ~15m, `@nestjs/jwt`) + **opaque refresh** (256-bit, sha256 in DB) in an
  **httpOnly cookie** (path `/v1/auth`). **Rotation + reuse detection** (replay → whole family
  revoked). argon2id hashing. **Deviation:** Passport not used (roadmap said "Passport+argon2") —
  `@nestjs/jwt` + custom guard is leaner for a JWT-only flow; argon2 kept.
- **Enumeration-safe login** (same 401 + dummy-hash timing equalization via a valid `DUMMY_HASH`);
  forgot-password always 200; reset revokes all sessions; KVKK consent required; Turnstile verified
  when the secret is set; per-route throttling on auth endpoints.
- **RLS ENABLE+FORCE** on `users`/`refresh_tokens`/`email_tokens`; policies allow self (`app.user_id`)
  or `app.role IN ('SERVICE','ADMIN')`. `withServiceContext` for pre-auth flows (only from
  auth-boundary services). Local `mentor` DB is superuser → RLS bypassed locally; verify on Neon/prod.
- **Schema (0001 migration):** `users` + `organizations` + `coach_students` (Phase-2-ready, unused),
  `refresh_tokens` (hash + family), `email_tokens`.
- **Guards (global):** `JwtAuthGuard` (+`@Public()`), `RolesGuard` (+`@Roles()`, umbrella-aware —
  see [admin.md](./admin.md)), `@CurrentUser()`. Health is `@Public`.
- **Email:** flows complete; dev `LoggerEmailAdapter` logs the link (W5 swaps in Postmark via
  `EMAIL_PORT` — moved to NotificationsModule in [notifications.md](./notifications.md)).

## Tutorials / Guides

```bash
pnpm db:up && pnpm --filter @mentor/api db:migrate
pnpm --filter @mentor/api dev      # Swagger: /v1/docs (auth uçları @Public)
pnpm --filter @mentor/web dev      # /kayit → /panel akışı; verify/reset linki api logunda
```

- New protected endpoints need nothing — the global guard applies; opt out with `@Public()`,
  restrict with `@Roles()`.
- Tenant-scoped queries: `withUserContext`; pre-auth/service paths: `withServiceContext` (only from
  auth-boundary services).
- Bootstrap the first admin/super-admin (no self-service) via SERVICE-context SQL:
  ```sql
  begin; select set_config('app.role','SERVICE',true);
  update users set roles = array_append(roles,'ADMIN') where lower(email)=lower('you@ex.com'); commit;
  ```

### Auth endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/v1/auth/signup` | KVKK consent required; Turnstile when secret set |
| POST | `/v1/auth/login` | Enumeration-safe (same 401 + dummy-hash timing) |
| POST | `/v1/auth/refresh` | Cookie-scoped `/v1/auth`; rotation + reuse detection |
| POST | `/v1/auth/logout` | Revokes refresh family |
| POST | `/v1/auth/verify-email` | Consumes `email_tokens` |
| POST | `/v1/auth/forgot-password` | Always 200 (hides existence) |
| POST | `/v1/auth/reset-password` | Revokes all sessions |
| GET / PATCH | `/v1/users/me` | Minimal onboarding: displayName / examType / examDate |

## API

| Endpoint | Purpose |
|---|---|
| `POST /v1/auth/{signup,login,refresh,logout,verify-email,forgot-password,reset-password}` | Auth lifecycle |
| `GET /v1/users/me` | Current user (consumed by coaching, notifications, admin) |
| `PATCH /v1/users/me` | Onboarding (displayName, examType, examDate) |

## Geliştirmeler (timeline)

- **W0 Identity (auth + RLS + web auth screens)** — schema 0001 (users/organizations/refresh_tokens/
  email_tokens, RLS ENABLE+FORCE); own JWT + opaque refresh (httpOnly cookie, rotation + reuse
  detection); enumeration-safe login; argon2id; KVKK consent; Turnstile; global JwtAuthGuard +
  RolesGuard; full auth endpoints + `GET/PATCH /users/me`. orval api-client codegen activated (fetch
  mutator, `credentials:'include'` + bearer + `ApiClientError`). Web `(auth)` pages + `AuthProvider`
  (access token in memory + silent refresh + scheduled re-refresh) + guarded `(app)` group. 55 tests. *(0010.)*
- **Code-review fixes** — throttling was silently a no-op (`throttlers: []` → named `default`
  throttler so `@Throttle` overrides apply; re-test 10×401 → 429); invalid-but-regex-passing examDate
  → 500 fixed at both belts (zod refine for real calendar date + `22007/22008` in the pg-error
  mapper → 400); signup check-then-insert race → catch `23505` → `AUTH_EMAIL_IN_USE`; removed the
  `false as never` KVKK cast. Verified non-issues: `DUMMY_HASH`, SameSite=lax, garbage bearer → 401. *(0011.)*
- **Web auth UI polish** — shared `AuthShell` for all `(auth)` routes (Mentor branding, motion card,
  "Ana sayfaya dön" link); `AuthNavLink` for cross-page nav (44px touch, heading font, no bare
  underline); all pages use `SectionHeading` + consistent form spacing; KVKK checkbox min touch
  target; `eposta-dogrula` eslint-safe `useEffect` with active flag. *(0036.)*

## Gotchas / Known issues

- **Refresh cookie is scoped to `/v1/auth`** — it never travels with normal API calls. SameSite=lax
  is same-site for web:3000/api:3001 (port ignored) and for prod subdomains.
- **`JWT_ACCESS_SECRET` is required** (≥32 chars); dev value lives in `apps/api/.env`.
- **OpenAPI response/body schemas are weak** (zod DTOs aren't introspected) → generated client types
  are loose; FE casts via `@mentor/types` (e.g. `usersControllerUpdateMe` is `void` — cast to
  `AuthUser`). Follow-up: zod→OpenAPI enrichment, then regenerate.
- **forgot-password has a minor timing oracle** (known user → DB+email work). W5 moves email to the
  queue, which closes it; risk is low (always-200 body already hides existence).
- **A consumed-but-expired email token** reports `AUTH_TOKEN_INVALID` on retry (cosmetic).
- **`AuthNavLink` children must be plain `string`** (avoids React 19 / Next `Link` ReactNode type clash).
- **Landing funnel points to `/kayit` and `/giris`** — keep CTA paths aligned.
- **e2e boot can exceed 10s on Windows** → vitest `hookTimeout: 30s`.

## Related

- Seam: [coaching.md](./coaching.md) (`UsersService.getMe`), [notifications.md](./notifications.md)
  (`getNotificationContact`), [admin.md](./admin.md) (user management, KVKK), [payments.md](./payments.md)
  (STAFF entitlement)
- Web: `(auth)` pages, `AuthProvider`, `/profil` ([web-shell.md](./web-shell.md))
- Status: [core/mvp-status.md](../core/mvp-status.md) (W0)
