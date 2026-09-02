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
| `DELETE /v1/account` | Self-service KVKK erasure ("hesabımı sil") — irreversible |

## Geliştirmeler (timeline)

- **Yoldaşlık sesi Dalga 17 — form kontrol et (2026-08-29)** — Şifre sıfırlama success ve profil `form_error` companion. Kullanım: [`docs/copy/voice.md`](../copy/voice.md). Gotcha: yeni anahtar yok. İlgili: `apps/web/messages/{tr,en}.json`.

- **Yoldaşlık sesi Dalga 5 — auth invalid_link (2026-08-29)** — `verify_email` / `reset_password` `invalid_link` companion: “Lütfen” kalktı. Kullanım: [`docs/copy/voice.md`](../copy/voice.md). Gotcha: KVKK ve ödeme gerçeği dokunulmadı. İlgili: `apps/web/messages/{tr,en}.json`.

- **Auth hang on signup (2026-08-28)** — Same rim sandwich as login, now also on
  `/signup` (`/kayit`). `displayName` and `email` look down; password covers.
  Checkboxes stay idle. The signup form is still hang-agnostic — focus is captured
  on the sheet. Related: `auth-paths.ts`, `auth-hang-choreography.ts`.
- **Auth hang Puhu sprites (2026-08-28)** — Login sheet companion art lives at
  `apps/web/public/mascot/puhu/auth/` (`hang-rest` / `blink` / `gaze-left` / `gaze-right` /
  `look-down` / `cover`). Magenta-keyed, shared 384×384 canvas, not trimmed per frame.
  `cover` uses both wings over both lenses. Wired on `/login` only: Puhu sits on the sheet
  rim. Two copies sandwich the sheet face: the body sits behind so the baked
  white cut (the “underline”) is hidden by the card; a front copy uses clip-path
  insets so the side hands sit on the rim (CSS mask luminance hid them). Idle bob (4px / 2s, same idea as
  `.mentor-puhu-bounce`) pauses while a field is focused. Email focus →
  look-down, password focus → cover, `prefers-reduced-motion` freezes idle on rest (focus
  still swaps). Focus is captured on the sheet from `input[name=email|password]` so the
  login form stays hang-agnostic. Signup is a later slice. Usage: focus the fields. Gotcha:
  do not put the sprite inside the scroll area — `overflow-hidden` clips the hang. Login
  `main` keeps `padding-top: HANG_OVERHANG_PX` so the hang can sit above the rim. Related:
  `auth-shell.tsx`, `auth-hang-puhu.tsx`, `auth-hang-choreography.ts`.
- **Onboarding açıklama metinleri kaldırıldı (2026-08-26)** — `/baslangic` profil ve sınav
  adımlarındaki yardımcı alt yazılar (kullanıcı adı/fotoğraf, JPEG/PNG 2 MB, sınav ailesi
  açılımı, KPSS düzey açıklamaları) kalktı; başlıklar ve seçenek etiketleri duruyor.
  Related: `profile-step.tsx`, `exam-step.tsx`.
- **Onboarding theme toggle kaldırıldı (2026-08-26)** — Signup sonrası `/baslangic` header’ındaki
  güneş/ay düğmesi kalktı (auth ile aynı). Tema Ayarlar → Görünüm’de. Related:
  `onboarding-step-layout.tsx`.
- **Auth sheet slide (2026-08-25)** — `/giris` / `/kayit` / nested auth use a bottom sheet
  that slides up by its measured height after layout. Login/signup have no header control;
  forgot/reset/verify chevron → `/giris`. Successful sign-in and Google start wait for the
  close slide before navigating. Login↔signup stay on the open sheet. Reduced-motion skips
  the transition. Related: `auth-shell.tsx`, `globals.css`, `auth-paths.ts`.
- **Auth sheet chrome + signup sadeleştirme (2026-08-25)** — `/giris`, `/kayit`, şifre sıfırlama
  ve e-posta doğrulama artık centered kart değil: mobilde alta yaslı bottom-sheet (slide-up),
  desktop’ta ortalanmış kart. Theme toggle auth’tan kalktı (varsayılan tema). Login/signup
  subtitle’ları ve signup’taki kullanıcı adı + hedef alanları kaldırıldı — username onboarding
  `ProfileStep`’te, hedef `GoalStep`’te kalır (unique hâlâ `AUTH_USERNAME_IN_USE`). KVKK
  checkbox kayıtta durur; Yasal footer gizlenir. Analytics cookie banner yalnız public
  yüzeylerde (bilgi yazısı, yasal, forum) çıkar — welcome `/`, auth, onboarding ve app’te yok.
  Yalnız `/kayit`’te opsiyonel analitik checkbox vardır (işaretli `accept`, değilse `reject`);
  girişte yok. Analytics kaydı zorunlu değil — KVKK rızası ayrı ve zorunlu kalır.
  Forgot/reset/verify “Girişe dön” text linki sheet header’daki ikona taşındı.
  Usage: `/giris` ve `/kayit`’te close yok, başlık ortalı; nested sayfalar chevron → `/giris`
  (desktop dahil). `/kayit` sonrası username yoksa
  `/baslangic`. Gotcha: API `signup.username` optional kaldı; Google kaydı zaten
  onboarding’e düşer. Related: `auth-shell.tsx`, `auth-paths.ts`, `signup/page.tsx`,
  `analytics-consent.tsx`, `(auth)/layout.tsx`.
- **Welcome `/` cookie banner kapalı (2026-08-25)** — `localhost:3000` welcome slaytlarında
  analitik çerez modalı çıkıyordu çünkü `/` public landing sayılıyordu. Welcome onboarding
  chrome’u; banner yalnız `/knowledge/[slug]`, `/legal/*`, `/forum/*`. Usage: `/` → Atla /
  slayt, modal yok. Related: `consent-banner-path.ts`.

- **Onboarding light/dark surfaces (2026-08-15)** — Wizard card, avatar well, and exam
  pills use `--color-surface` / `--color-border`. Selected exam check uses
  `--color-btn` / `--color-btn-label`. Theme toggle was removed from the step header
  (switch in Settings → Appearance). Usage: `/onboarding`. Related:
  `onboarding-step-layout.tsx`, `profile-step.tsx`, `exam-step.tsx`,
  `docs/features/web-shell.md`.

- **Auth light/dark surfaces (2026-08-15)** — `/giris`, `/kayit`, and the shared auth card
  use `--color-surface` / `--color-border`. Google icon well and the soft back-link
  follow the same. Theme toggle sits in the card header (no AppNav on auth).
  Usage: `/giris` → moon/sun. Related: `auth-shell.tsx`, `google-auth-button.tsx`,
  `circular-back-link.tsx`, `docs/features/web-shell.md`.

- **Settings light/dark surfaces (2026-08-15)** — `/ayarlar` list rows, notification toggles,
  profile edit chips, and invite redeem dock use `--color-surface` / `--color-btn-label`.
  Appearance (Açık/Koyu) sits next to language in the App card so mobile can switch
  theme without the desktop sidebar. Invite hero copy on the decorative overlay stays
  white. Usage: `/ayarlar` → Uygulama → Görünüm. Related: `profile-shell.tsx`,
  `application-support-card.tsx`, `notification-settings.tsx`, `docs/features/web-shell.md`.

- **KVKK silme tamamlama + RLS izolasyon kanıtı (WP-K, 2026-07-22)** — `DELETE /v1/account` artık
  forum + sosyal graf + bildirim verisini de kapsıyor (önceden yalnız identity/ai/coaching):
  forum içeriği **redakte** edilir (`"[silinmiş içerik]"` — başkalarının sohbeti bozulmasın),
  reaksiyon/bookmark/üyelik/rapor/ek + `user_follows`/`buddy_pairs` (iki yön) +
  push/tercih/teslimat/inbox **hard delete**; ledger + ödeme kayıtları yasal saklamayla durur.
  Sıra: ai → coaching → forum → social → notifications (`AccountErasureService`); her modül kendi
  tablosunu siler. Usage: kanıt `test/account-erasure.e2e-spec.ts` (test-first, 10 test, tablo tablo
  assert + idempotent ikinci DELETE). Ayrıca `test/rls-isolation.e2e-spec.ts` RLS'i İLK KEZ gerçek
  policy'yle test eder: kendi kendini kuran `rls_probe` (NOSUPERUSER/NOBYPASSRLS) rolüyle 4 temsili
  tabloda cross-user 0 satır + context'siz 0 satır + INSERT reddi. Gotcha: `coach_messages` policy'si
  (0044) `app.user_id`'yi `::uuid` cast'ler — boş string context'te sorgu filtrelemek yerine HATA
  verir (yine de sızıntı yok); diğer policy'ler text karşılaştırır. Related: `forum-erasure.*`,
  `social-erasure.service.ts`, `notifications-erasure.service.ts`, `account-erasure.service.ts`.
- **Hesap silme UI sadeleştirmesi (2026-07-18)** — `/profil`deki ayrı “Tehlikeli bölge” kartı kaldırıldı; **Hesap** kartına kırmızı “Hesabımı sil” satırı eklendi. Usage: satıra dokununca mevcut paylaşılan onay dialogu geri alınamazlık, silinen veriler, abonelik iptali ve yasal olarak korunan fatura kayıtları açıklamasıyla açılır; kullanıcı onay verirse mevcut `DELETE /v1/account` çağrılır. Gotcha: silme hâlâ sunucu tarafındaki KVKK anonimleştirme akışını kullanır; yeni endpoint veya modal altyapısı yoktur. Related: `account-links-card.tsx`, `mentor-dialog.ts`, `profile.spec.ts`.
- **Profil bio + web sitesi (APP-024)** — Kullanıcı artık kendisi hakkında kısa bir **bio** + bir **web
  sitesi** linki girip düzenleyebiliyor ("profil kartı sosyal alanları" backlog'unun son parçası). `users`
  tablosuna iki nullable kolon (`bio`, `website` — migration `0042`). `updateMeSchema`'ya `bio` (≤200) +
  `website` (`.url()`, ≤200) eklendi; **`z.preprocess(emptyToNull, …)`** ile boş/whitespace → `null`
  (temizleme). `AuthUser` + `PublicProfile` + `toAuthUser` + `UsersService.updateMe` patch spread'i +
  `CommunityService.getPublicProfile` bio/website taşır (public-safe — kimlik, PII değil; email hâlâ gizli).
  **OpenAPI+api-client regen** (`/profil` orval `usersControllerUpdateMe`/`Me` kullanıyor; `UpdateMeDto`
  createZodDto'dan `{[key]:unknown}` loose kaldığından body zaten bio/website'i taşıyor). Web: `/profil`
  düzenleme formuna (`ProfileEditForm`) bio `TextAreaField` (200 sayaç) + website `TextField`; community
  profil header'ında (`/topluluk/uye/[username]`) bio (`whitespace-pre-line break-words`) + website (güvenli
  dış link, `noopener noreferrer nofollow`, Globe) + `isOwn`'da "Profili düzenle" linki (→ `/profil`); sağ
  `ProfileCard`'da bio (3-satır clamp) + website (düz metin — kart zaten `<Link>`, nested-anchor'dan
  kaçınıldı). i18n: `profile.edit.{bio,website}_*`, `topluluk.edit_profile`. Testler: `UsersService.updateMe`
  unit +1 (bio/website patch, null clear), forum e2e profil testine bio/website assertion. **Kapsam dışı**:
  bio'da @mention/link render, community içi inline form, website unfurl/favicon, çoklu sosyal link. *(APP-024)*
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
- **Dev boot race — wait gate + backoff widened (2026-07-23)** — Cold `pnpm dev` on Windows often
  took Nest >30s to `listen()`; `wait-for-port` timed out (`starting anyway`), Next served `/giris`
  while API was still mapping routes → `ERR_CONNECTION_REFUSED` on `/v1/auth/google/status` and
  3–4 rapid `/v1/auth/refresh` calls, then `clearSession()` dropped a still-valid cookie until
  manual reload. Fixes: (1) `scripts/wait-for-port.mjs` default timeout **30s → 120s** (still
  start-anyway for FE-only); (2) web `silentRefresh` exponential network backoff (~30s window,
  8 attempts) + module-scoped in-flight coalesce (Strict Mode remounts); (3) admin `/users/me`
  mount retries use the same backoff. Usage: cold `pnpm dev` — web/admin wait until :3001 accepts
  TCP (or 120s). Gotcha: if API is intentionally down, FE still starts after 120s; session may
  stay `loading` up to ~30s of retries before anonymous. Related: `wait-for-port.mjs`,
  `apps/web/src/lib/auth-context.tsx`, `apps/admin/src/contentApi/authProvider.tsx`.
- **Dev boot — API and web run separately (2026-08-25)** — `pnpm dev` started Next while Nest
  was still compiling (or failing TypeScript), so `/giris` hit `ERR_CONNECTION_REFUSED` on
  `/v1/auth/refresh`. The compile blocker was `SessionReflectionDto.suggestedTask` rejecting
  `null`. Usage: two terminals — `pnpm --filter @mentor/api dev` then
  `pnpm --filter @mentor/web dev` after `Mentor API → …`. Related: `session-reflection.service.ts`.

- **Hesabımı sil — self-service KVKK (2026-07-14)** — Dilim 13'te bütünsel silme makinesi kurulmuştu
  ama yalnız admin tetikleyebiliyordu; "unutulma hakkı" veri sahibinin kendisine ait. Yeni
  `DELETE /v1/account` (auth'lu) kullanıcının kendi hesabını siler. **Yeni ince `modules/account`**
  bounded context'i orkestrasyonu barındırır — identity foundational modül olduğu için (Ai/Coaching/
  Payments hepsi onu import ediyor) orkestrasyon identity'ye konsaydı **döngü** olurdu. Sıra:
  ① abonelik iptali (`SubscriptionsService.cancel`; açık abonelik yoksa `NotFound` yutulur — silinen
  hesap faturalanmaya devam etmemeli) → ② `AiErasureService` + `CoachingErasureService` → ③
  `UsersService.anonymizeAccount` (identity kendi tablosunu kendi scrub eder; admin artık `users`'a
  doğrudan yazmaz) + `TokenService.revokeAllForUser` → ④ avatar objesi (best-effort).
  Yeni `UserStatus.DELETED`; login gate zaten `status !== ACTIVE` dediği için giriş otomatik bloklanır.
  **Admin `anonymize` artık aynı servisi** `BANNED` statüsüyle çağırır → tek erasure yolu, sıfır kopya
  (`admin-users.repository.anonymize` silindi). **Korunan:** fatura/ödeme kayıtları (iyzico e-arşiv —
  yasal saklama) + append-only ledger; satır anonimleştirilir, silinmez, FK'lar sağlam kalır.
  FE: `/profil` "Tehlikeli bölge" kartı — yazarak onay (`HESABIMI SİL`; şifre re-entry Google-only
  hesaplarda çalışmaz). Dosyalar: `modules/account/*`, `users.repository.ts`, `users.service.ts`,
  `identity.constants.ts`, `admin-users.service.ts`(+spec), `delete-account-card.tsx`.

### 2026-08-31 — Private-route indexing and minimal activation analytics

- Auth and onboarding layouts now expose `noindex, nofollow` metadata from server layouts and send
  only the client translation namespaces they use. The authenticated app shell was split into a
  metadata-capable server layout and the existing client auth/navigation shell without changing
  refresh, guard or navigation behavior.
- Successful email/password login and signup emit consent-gated GA4 `login` / `sign_up` events with
  `method: "email"`. Onboarding emits `tutorial_begin` once when an incomplete authenticated user
  enters and `tutorial_complete` once at the final action. Google OAuth is intentionally not
  instrumented because the frontend has no trustworthy success contract that distinguishes login
  from signup. No event is queued before consent.
- Usage: no caller action is required; the events follow the existing identity UI. Gotcha: enabling
  analytics in the signup checkbox happens before the successful signup request, so a successful
  completion can be measured while a rejected or failed request emits no `sign_up`. Related:
  `(auth)/{layout,login,signup}`, `(onboarding)/{layout,_components/onboarding-wizard.tsx}`,
  `(app)/{layout,app-shell}.tsx`, `lib/analytics.ts`.

### 2026-09-02 — Conversational post-signup onboarding

- Post-signup questions now use named steps with a fixed five-part progress model: required username,
  optional avatar, required exam, conditional required KPSS level, and optional one-line goal. YKS/LGS
  paths jump over the KPSS segment; avatar and goal expose “Şimdilik geç”. Choices advance only after
  explicit confirmation.
- Puhu and a polite live speech bubble share one `max-w-3xl` responsive stage. Focus makes Puhu look
  toward the active control, step changes move focus to the new prompt, and reduced-motion keeps the
  flow usable without choreography. Completion automatically preserves a pending room invite or opens
  the personalized dashboard through the cloud transition.
- Existing user update, signed avatar upload, vision upsert, and tutorial analytics contracts are
  unchanged. Related: `(onboarding)/_components/{onboarding-wizard,onboarding-step-layout,onboarding-flow}.tsx`,
  `(onboarding)/_components/steps/*`, `messages/{tr,en}.json`.

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
