# Identity — Auth, Sessions, OAuth, Phone OTP & Waitlist (`modules/identity` · W1)

> Foundation bounded context: `users`, JWT + refresh rotation, Google OAuth, Turkey SMS OTP,
> profile & onboarding (`examType`), one-way follow graph, KVKK erasure, and pilot waitlist gate.

---

## 1. Overview & Architecture

`IdentityModule` is the foundation of the monorepo. Every authenticated request resolves through
its global `JwtAuthGuard` and `RolesGuard`, and every tenant-scoped DB query runs inside its RLS
context helpers (`withUserContext` / `withServiceContext`).

- **Own JWT + Session-Bound Opaque Refresh:**
  - Short-lived access JWT (~15m, includes `sid`) + 256-bit SHA-256 refresh token in an `httpOnly` cookie (`/v1/auth/refresh` for B2C web, separate `mentor_admin_refresh` at `/v1/auth/admin/refresh` for `apps/admin`).
  - Every protected request reloads the active account, session, and roles. Refresh rotation is transactional; replay of a rotated token revokes the entire token family.
  - Password hashing uses **argon2id** with dummy-hash timing equalization on login.
- **Google OAuth (`/v1/auth/google/*`):**
  - OpenID Connect authorization code flow keyed on Google `sub` (`user_auth_accounts`).
  - **No automatic email-merge:** Email equality never auto-links an existing password account. Linking requires an authenticated session, current password confirmation, and verified matching email (`POST /v1/users/me/auth-accounts/google/start`).
- **Turkey Mobile OTP (`/v1/users/me/phone/*`):**
  - Application-owned OTP challenges over `SmsPort` (`Netgsm` in prod or `disabled`), Turnstile-verified (`phone-verification`), with keyed HMAC phone fingerprints (`PHONE_FINGERPRINT_SECRET`) so raw phone numbers are never used as cross-module lookup keys.
  - Transport (`SMS_PROVIDER=disabled`, `identity.phone.enabled=false`) is decoupled from downstream policy requirements (`payments.trial.phone_verification_required`, `mentorship.phone_verification_required`).
- **Pilot Waitlist & Invite-Only Admission (`signup_invitations`, `APP-138`):**
  - When `signup.enabled=true` and `signup.pilot.enabled=true`, public signup admits only emails with an `invited` row in `signup_invitations`; visitors without an invite join the waitlist (`POST /v1/auth/waitlist`, `WaitlistModal` in energetic **Puhu** register).
  - Admin approval (`/v1/admin/waitlist`, serialized under `pg_advisory_xact_lock`) sends the `identity.signup-invitation` email (`/kayit?davet=1`). Invitations expire after 6 months (`invited_at` window enforced at read time and purged by daily cron).
- **Full-Scope KVKK Erasure (`DELETE /v1/account`):**
  - Anonymizes `users` (`deleted+<id>@anonymized.local`, `"Silinmiş Kullanıcı"`, status `BANNED`), deletes `signup_invitations` and mutable personal records across Coaching/AI/Notifications/Economy, and redacts Forum posts in place while retaining immutable financial/ledger audit trails.

---

## 2. API Surface

| Method & Path | Purpose |
|---|---|
| `POST /v1/auth/{signup,login,refresh,logout,verify-email,forgot-password,reset-password}` | Student/coach auth lifecycle (Turnstile + enumeration-safe) |
| `POST /v1/auth/admin/{login,refresh,logout}` | Separate admin session & `mentor_admin_refresh` cookie |
| `GET /v1/auth/google/{status,start,callback}` | Google OAuth sign-in / sign-up |
| `GET\|POST /v1/users/me/auth-accounts/google{,/start}` | Inspect or initiate password-confirmed Google linking |
| `POST /v1/auth/waitlist` | Join public invite-only pilot waitlist |
| `GET\|PATCH /v1/users/me` | Profile & onboarding (`displayName`, `username`, `examType` across `KPSS · YKS · LGS · ALES · DGS`, `avatarStorageKey`) |
| `POST /v1/users/me/verification-email` | Resend verification email (serialized under user lock) |
| `POST /v1/users/me/avatar-upload-url` | Single-use presigned R2 avatar upload ticket |
| `GET /v1/users/me/phone`, `POST .../verifications{,/:id/confirm}` | Masked phone status, OTP send, and one-use code confirmation |
| `PUT\|DELETE /v1/users/:username/follow`, `GET .../{followers,following}` | One-way public follow graph (`community.social.enabled`) |
| `DELETE /v1/account` | Irreversible self-service KVKK account erasure |

---

## 3. Geliştirmeler (Condensed Milestone Timeline)

- **2026-11-08 — Waitlist opening and closing motion:** The native backdrop now fades with the existing card motion: 250ms on mobile, 200ms on desktop, and 150ms on dismissal. The shared Modal exposes its existing open/closing state so waitlist-only styles can synchronize without timers or a second animation library. Reduced motion disables the backdrop transition; X, Escape, backdrop dismissal and success completion keep the existing close lifecycle and focus restoration. Modern browsers use `@starting-style` for the entry fade; older browsers retain the card motion and may show the scrim immediately. Related files: `packages/ui/src/components/modal.tsx`, `apps/web/src/components/waitlist/waitlist.css`, `apps/web/e2e/waitlist.spec.ts`.

- **2026-11-08 — Centered Desktop Auth:** Login, signup, password recovery/reset and email verification share a centered desktop card with the existing rim-gripping Puhu and focus reactions. Removed the desktop narrative column and its unused TR/EN copy; form titles are now primary headings. Mobile sheet placement and mascot visibility remain unchanged, desktop keeps the handle hidden, and long forms scroll with the page. Related files: `(auth)/_components/auth-shell.tsx`, `(auth)/*/page.tsx`, `globals.css`, `e2e/auth-layout.spec.ts`, `e2e/onboarding-redesign.spec.ts`.
- **2026-11-08 — Landing Login Waitlist Entry:** Student and coach landing navigation now uses the existing `SignupCta` for login: when `signupWaitlist` is on (or availability is unknown), it opens the waitlist modal. Invited pilot users continue through the modal's existing login link; open signup restores direct login navigation. No new route or admission policy. Related files: `apps/web/src/app/[locale]/_components/landing/landing-nav.tsx`, `apps/web/e2e/waitlist.spec.ts`.
- **2026-11-05 — Pilot Waitlist Admission (`APP-138`), Resend Lock & 29-Table RLS Force Hardening (`0141`, `0142`):** Shipped `signup_invitations` waitlist flow (`POST /v1/auth/waitlist`, admin `/waitlist`, `WaitlistModal` in energetic Puhu voice), added advisory locks on waitlist capacity and user locks on verification-email resends, cleaned up waitlist PII on KVKK erasure, and enforced `ENABLE + FORCE ROW LEVEL SECURITY` across all 29 user/behavioral/queue tables (`0142_rls_force_hardening.sql`).
- **2026-11-03 — Shared 5-Exam Onboarding (`ALES` & `DGS`, `APP-132`):** Connected student and coach onboarding and settings to `EXAM_CATALOG` (`KPSS · YKS · LGS · ALES · DGS`).
- **2026-10-28..31 — Localized Auth Emails (`Resend`), Turnstile Preflight & Strict-Mode Verify Guard:** Preserved `Accept-Language` (`tr`/`en`) in queued auth emails via `Resend`, verified Cloudflare Turnstile replay protection, and deduplicated Strict-Mode email verification POSTs.
- **2026-10-02..15 — Turkey Mobile SMS OTP (`Netgsm`) & Phone-Optional Rollout Switches (`APP-114`):** Shipped `/v1/users/me/phone/*` OTP challenges, HMAC phone fingerprints, and independent requirement switches.
- **2026-09-05..23 — Session-Bound JWT (`sid`), Separate Admin Refresh Cookie & Google Account Linking (`0102`):** Hardened server-side sessions, isolated `/v1/auth/admin/*` cookies, and shipped password-confirmed Google OAuth linking.
- **2026-07-15..25 — W1 Foundation, Follow Graph & Full KVKK Erasure (`0006–0008`, `APP-022`, `WP-K`):** Built JWT + argon2 auth, RLS helpers, one-way follow graph, and cross-module KVKK anonymization.
