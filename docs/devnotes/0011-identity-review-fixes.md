# 0011 — W0 Identity: Code-Review Fixes

> Date: 2026-06-10 · Scope: api (identity) + web · Related: devnote 0010, docs/standards/code-review.md

## What was done
Review of W0 against the standards checklist; findings verified **empirically**, then fixed:
- **Throttling was silently a no-op (real bug):** `ThrottlerModule.forRoot({ throttlers: [] })` renders
  route-level `@Throttle` inert (proven: 12 bad logins → all 401, no 429). Fix: a named `default`
  throttler (300/min global, generous) so `@Throttle` overrides apply. Re-test: 10×401 → **429**. ✔
- **Invalid-but-regex-passing examDate → 500:** `2026-13-99` passed the regex, Postgres threw `22008`
  (unmapped) → INTERNAL_ERROR. Fix at both belts: zod refine (real calendar date) + `22007/22008` added
  to the pg-error mapper (→ 400).
- **Signup check-then-insert race:** concurrent duplicate email hit the unique index → generic `CONFLICT`
  instead of `AUTH_EMAIL_IN_USE`. Fix: catch `23505` on insert → proper code.
- **Web cleanup:** removed the `false as never` cast on KVKK consent (explicit pre-submit check + message).

## Verified non-issues (checked, no change)
- `DUMMY_HASH` is a valid argon2 hash (login timing equalization works — verified with argon2.verify).
- Refresh-cookie SameSite=lax is same-site for web:3000/api:3001 (port ignored) and for prod subdomains.
- Garbage bearer token → 401 (not 500).

## Accepted (documented, deferred)
- forgot-password has a minor timing oracle (known user → DB+email work). W5 moves email to the queue,
  which closes it; risk is low (always-200 body already hides existence).
- A consumed-but-expired email token reports `AUTH_TOKEN_INVALID` on retry (cosmetic).
- Loose generated client types (OpenAPI schema gap) — already tracked in devnote 0010.

## Result
typecheck/lint/build green · **55/55 tests** · throttle verified live.

## Related files
- `apps/api/src/app.module.ts` (throttler) · `common/errors/postgres-error.ts` ·
  `modules/identity/application/auth.service.ts` · `packages/validation/src/auth.ts` ·
  `apps/web/src/app/(auth)/kayit/page.tsx`
