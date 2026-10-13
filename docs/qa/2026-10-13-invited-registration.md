# Invited registration verification (2026-10-13)

Scope: new-account admission through password signup and Google OAuth. Existing login/linking,
roles, CAPTCHA, legal consent and verification stay in their existing boundaries.

## Reproduction and focused checks

- Before the fix, eight password/Google service cases incorrectly created an account/session
  when registration was closed or the address was not invited. The service regression was
  observed failing before introducing the shared admission policy.
- Final focused unit verification: 136 tests passed across admission, private invitation env
  parsing, existing auth/OAuth, environment locks, config registry, CAPTCHA/auth security and
  Cloudflare Access guard suites.
- Real PostgreSQL: 13 new HTTP/OAuth admission cases passed, including localized TR/EN errors,
  no account/session on rejection, normalized password signup, verified Google signup, existing
  login after closure, empty/oversized lists and absence of private list data from config/status.
  Existing auth lifecycle: 26 tests passed. Local tests use a dedicated
  `mentor_invited_pilot_test` database, separate from the primary checkout's test DB and Neon.
- API typecheck/build, targeted API/browser ESLint and production deployment check passed.
  Browser regressions in `apps/web/e2e/pilot-signup.spec.ts` exercise the existing form and OAuth
  feedback with actual backend locale messages in both languages and both viewports.

## Full revision acceptance

The new PR's description and [branch CI](https://github.com/yunusemreerkesikbas/MentorApp/actions?query=branch%3Afeat%2Finvited-pilot-registration)
record final exact-head results. Require complete lint/typecheck/build/tests, browser smoke and
CAPTCHA/security checks, dependency audit and secret scan before review-ready completion.
Focused local results alone are not a whole-workspace or live-environment readiness claim.

## Operational limits

- `signup.enabled=false` overrides invitations. Pilot mode defaults off and must be explicitly
  enabled before using this registration boundary for a live pilot.
- Private invitation values belong only in API environment settings. Blank values admit nobody
  in pilot mode; malformed/duplicate entries fail startup without printing addresses.
- The configurable cap (default/max 50) bounds list size, not lifetime account count. Address
  removal stops future admission; use existing user suspension/revocation for existing access.
- List changes require restart; registry flags use the existing single-process cache.
- No schema migration, new endpoint, real invitee data, provider key, AI entitlement, paid resource,
  DNS update, production/staging activation or PR merge is performed by this development.
- Pilot code is isolated in a managed worktree; the main checkout's parallel coach work and
  production-preparation PR #156 remain unchanged.
