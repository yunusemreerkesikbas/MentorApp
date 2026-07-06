# Identity

> Auth (own JWT + refresh rotation + RLS), user onboarding, KVKK consent, web auth screens.
> Module: `modules/identity`. Workstream: W0 (foundation — everything depends on this).

## Overview

Identity is the foundation module. It owns the `users` table (roles `text[]`, org-ready, KVKK
timestamps, status), the auth lifecycle (signup/login/refresh/logout/verify-email/forgot-password/
reset-password), Google OAuth sign-in, `GET/PATCH /users/me` (minimal onboarding), the global JwtAuthGuard + RolesGuard,
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
- **Google sign-in** uses Google Authorization Code + OpenID Connect on the backend. Google `sub`
  is the stable provider key; Google tokens are not stored. Existing email/password accounts are
  auto-linked only when Google reports `email_verified=true`. The public UI is gated by
  `identity.google_oauth.enabled` in the admin config registry.
- **RLS ENABLE+FORCE** on `users`/`refresh_tokens`/`email_tokens`; policies allow self (`app.user_id`)
  or `app.role IN ('SERVICE','ADMIN')`. `withServiceContext` for pre-auth flows (only from
  auth-boundary services). Local `mentor` DB is superuser → RLS bypassed locally; verify on Neon/prod.
- **Schema:** `users` + `organizations` + `coach_students` (Phase-2-ready, unused),
  `refresh_tokens` (hash + family), `email_tokens`, `user_auth_accounts`.
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
| GET | `/v1/auth/google/status` | Public Google button availability (`enabled`, plus flag/config diagnostics) |
| GET | `/v1/auth/google/start` | Starts Google OAuth (`mode=login|signup`; signup requires KVKK flag) |
| GET | `/v1/auth/google/callback` | Google callback; sets Mentor refresh cookie then redirects to web |
| POST | `/v1/auth/refresh` | Cookie-scoped `/v1/auth`; rotation + reuse detection |
| POST | `/v1/auth/logout` | Revokes refresh family |
| POST | `/v1/auth/verify-email` | Consumes `email_tokens` |
| POST | `/v1/auth/forgot-password` | Always 200 (hides existence) |
| POST | `/v1/auth/reset-password` | Revokes all sessions |
| GET / PATCH | `/v1/users/me` | Minimal onboarding: displayName / username / examType / examDate |
| POST | `/v1/users/me/verification-email` | Authenticated resend for the current user's verification email |
| POST | `/v1/users/me/avatar-upload-url` | Signed upload URL for current user's JPEG/PNG avatar |

## API

| Endpoint | Purpose |
|---|---|
| `POST /v1/auth/{signup,login,refresh,logout,verify-email,forgot-password,reset-password}` | Auth lifecycle |
| `GET /v1/auth/google/{status,start,callback}` | Google OAuth sign-in/sign-up |
| `GET /v1/users/me` | Current user (consumed by coaching, notifications, admin) |
| `PATCH /v1/users/me` | Onboarding/profile (displayName, username, examType, examDate, avatarStorageKey) |
| `POST /v1/users/me/verification-email` | Resend verification email for current user |
| `POST /v1/users/me/avatar-upload-url` | Create user-scoped avatar upload URL |

## Geliştirmeler (timeline)

- **Signup username + hedef alanları** — web `/kayit` formu artık zorunlu `username` ve opsiyonel
  `goalTitle` alır. `username` identity signup payload'ına yazılır; `/v1` geriye uyumluluğu için API
  alanı opsiyonel kalır, eski/Google client'lar onboarding username adımını kullanmaya devam eder.
  Duplicate username signup sırasında `AUTH_USERNAME_IN_USE` döner. Opsiyonel hedef, başarılı signup
  oturumu açıldıktan sonra mevcut `POST /v1/coaching/vision` endpoint'ine best-effort kaydedilir.
  Usage: e-posta/şifre signup'ta kullanıcı adı kayıt sırasında alınır; Google signup akışında
  onboarding profile/goal inputları aynen kalır. Gotcha: hedef kaydı signup'ı bloklamaz; kullanıcı
  isterse onboarding/hedef ekranında tekrar düzenleyebilir. Related: `signupSchema`,
  `AuthService.signup`, `kayit/page.tsx`, `coachingControllerUpsertVision`, `auth.e2e-spec.ts`.
  *(2026-07-05.)*
- **Auth ekranı sadeleştirme** — `/giris` ve `/kayit` kartındaki üst marka/tagline metni kaldırıldı;
  form başlığı tek odak olarak kaldı. Google OAuth aksiyonu artık görselde yalnızca Google logosu olan
  48px ikon butonu olarak render edilir, erişilebilir adı lokalize `auth.google.continue` üzerinden
  korunur. Usage: `identity.google_oauth.enabled` açıksa ikon butonu divider altında görünür. Gotcha:
  signup tarafında Google başlangıcı hâlâ KVKK checkbox kabulünü ister. Related:
  `auth-shell.tsx`, `google-auth-button.tsx`. *(2026-07-05.)*
- **Auth ekranı redesign** — web `/giris` ve `/kayit` yüzeyleri referans mobil auth düzenine
  yaklaştırıldı: mevcut pastel blob arka plan korunur, ortak `AuthShell` dar beyaz mobil ekran
  yüzeyi verir, form başlıkları ortalanır, ana CTA Google girişinden önce gelir ve alt geçiş linkleri
  sakin accent renkle gösterilir. Usage: kullanıcı `/giris` veya `/kayit` açtığında aynı auth akışı
  ve Google/KVKK davranışı korunur. Gotcha: Google butonu hâlâ `identity.google_oauth.enabled`
  kapalıysa render edilmez; KVKK kabulü signup Google başlangıcından önce zorunlu kalır. Related:
  `auth-shell.tsx`, `auth-nav-link.tsx`, `giris/page.tsx`, `kayit/page.tsx`, `messages/{tr,en}.json`.
  *(2026-07-05.)*
- **Onboarding username kapısı** — post-auth tamamlanma kuralı artık `username + examType`
  gerektirir; Google callback de `examType` olsa bile username yoksa `/onboarding`'e döner. Username
  uniqueness yeni endpoint ile ön-kontrol yapılmadan mevcut case-insensitive DB unique index ve
  `PATCH /v1/users/me` duplicate → `AUTH_USERNAME_IN_USE` akışıyla çözülür. Gotcha: `users.username`
  nullable kalır; auth hesabı onboarding tamamlanmadan yaratılır. Related: `GoogleAuthService`,
  `UsersService`, `usernameSchema`. *(2026-07-03.)*
- **Google ile giriş** — `GET /v1/auth/google/start` ve callback eklendi; backend Google OAuth
  authorization code akışını `google-auth-library` ile doğrular, sadece `openid email profile`
  scope ister ve Google tokenlarını saklamaz. Usage: admin `/config` ekranında
  `identity.google_oauth.enabled` açılınca web login/signup ekranları
  `GET /v1/auth/google/status` üzerinden "Google ile devam et" butonunu gösterir; status cevabı
  `enabled`, `flagEnabled`, `configured` alanlarını döner. Signup için KVKK
  checkbox'ı hem client hem API start query'sinde zorunludur. Gotcha: Google Console redirect URI
  `GOOGLE_OAUTH_REDIRECT_URI` ile birebir aynı olmalı; credential env'leri eksikse status kapalı
  döner ve start 503 verir. Mevcut email/şifre hesabı yalnızca `email_verified=true` Google
  hesabıyla otomatik bağlanır. Related: `GoogleAuthService`, `CONFIG_CATALOG`,
  `user_auth_accounts`, `google-auth-button.tsx`. *(2026-07-03.)*
- **Profile avatar V1** — `users.avatar_storage_key` nullable kolonu eklendi; auth/session ve
  `GET/PATCH /v1/users/me` artık `avatarUrl` döner. Akış: client
  `POST /v1/users/me/avatar-upload-url` ile JPEG/PNG için user-scoped key alır
  (`avatars/{userId}/{uuid}.jpg|png`, max 2 MB), dosyayı storage URL'ine PUT eder, sonra
  `PATCH /v1/users/me` ile `avatarStorageKey` kaydeder veya `null` göndererek kaldırır. Gotcha:
  eski avatar object'i best-effort silinir; silme hatası profil kaydını bozmaz. Local fake storage
  preview için disk-backed `GET /v1/storage/fake-object?key=...` public dev endpoint'i kullanılır ve
  web origin'inden `<img>` render edilebilmesi için sadece bu dev object response'u
  `Cross-Origin-Resource-Policy: cross-origin` döner. Related:
  `UsersService`, `FakeStorageController`, `StoragePort`, `packages/{types,validation}/src/auth.ts`,
  `apps/api/drizzle/0031_perfect_leech.sql`. *(2026-07-03.)*
- **Profile verification resend** — `/profil` üzerindeki "Doğrulama bekliyor" chip'i artık
  auth'lu `POST /v1/users/me/verification-email` çağırır; backend mevcut verification token email
  kuyruğunu tekrar kullanır ve kullanıcı zaten doğrulanmışsa no-op döner. Usage: kullanıcı avatar
  üzerindeki doğrulama badge'ine dokunur, e-postadaki bağlantıya tıklaması gerektiğini anlatan bilgi
  dialog'unu görür. Rate limit admin config'ten yönetilir:
  `identity.verification_email.resend_limit` (default 1),
  `identity.verification_email.resend_window_seconds` (default 180) ve
  `identity.verification_email.token_ttl_seconds` (default 180). Gotcha: rate limit yalnızca
  `AUTH_VERIFICATION_EMAIL_RATE_LIMITED` koduyla kullanıcıya doğrulama e-postasına özel mesaj döner.
  resend denemelerini sayar; signup sırasında gönderilen ilk doğrulama e-postası bu pencereye dahil
  değildir. Email adresi body'de taşınmaz. Related: `AuthService.resendVerificationEmail`,
  `UsersController`, `email_verification_resend_attempts`,
  `profile-header.tsx`, `@mentor/api-client`. *(2026-07-03.)*
- **Silent refresh race fix** — Web `AuthProvider` refresh isteklerini tek uçuşta birleştirir ve
  eski refresh sonuçlarının daha yeni login/signup/profile state'ini ezmesini engeller. Usage:
  uygulama ilk açıldığında `/v1/auth/refresh` login ile yarışsa bile başarılı login oturumu
  korunur. Gotcha: refresh cookie hâlâ tek kullanımlık rotasyon + reuse detection kullanır; client
  sadece aynı tab içindeki benign yarışı söndürür. Related: `apps/web/src/lib/auth-context.tsx`.
  *(2026-07-03.)*
- **Username alanı** — `users.username` nullable + unique eklendi; `PATCH /v1/users/me` username
  günceller, `GET /v1/users/me` `AuthUser.username` döner. Format: `a-z`, `0-9`, `_`, 3-24
  karakter; duplicate → `AUTH_USERNAME_IN_USE`. Forum author görünümü `username ?? displayName`
  kullanır, KVKK anonymize username'i null'a çeker. Related: `apps/api/src/database/schema.ts`,
  `apps/api/drizzle/0028_users_username.sql`, `packages/{types,validation}/src/auth.ts`.
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
- **Mount silent-refresh hardened against dev boot race** — `Failed to fetch` on `/v1/auth/refresh`
  right after `pnpm dev` (API not listening yet) or during a `nest --watch` recompile. Two fixes:
  (1) `AuthProvider.silentRefresh` retries network errors 3× (300/600ms) and only a real
  `ApiClientError` (401/expired cookie) → anonymous — a blip no longer drops a valid session;
  (2) web `dev` script gates on `scripts/wait-for-port.mjs 3001` so cold boot never fires at a
  down API (times out → starts anyway, so FE-only work isn't blocked). Admin got the same treatment:
  `dev` port gate + `authProvider` mount `/users/me` retries network errors 3× (axios `!err.response`),
  so the boot race no longer leaves the panel stuck with a null admin. *(0037.)*

## Gotchas / Known issues

- **Refresh cookie is scoped to `/v1/auth`** — it never travels with normal API calls. SameSite=lax
  is same-site for web:3000/api:3001 (port ignored) and for prod subdomains.
- **`JWT_ACCESS_SECRET` is required** (≥32 chars); dev value lives in `apps/api/.env`.
- **Google callback 500 after setup usually means migrations are missing** — run
  `pnpm --filter @mentor/api db:migrate` so `user_auth_accounts` exists before retrying the OAuth
  flow. Google authorization codes are single-use; restart from `/giris`, not the old callback URL.
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
