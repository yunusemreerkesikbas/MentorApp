# Account security QA scenarios

Scope: the pre-release account security package. This is a focused QA plan, not a full
security audit. Existing concurrent community/forum work is outside this scope.

## Execution contract

- Use disposable dummy users and secrets. Never load the developer's `.env` into a test.
- Run target code and browsers only inside the security-audit skill's OS-enforced,
  network-isolated, resource-limited environment. External providers are simulated.
- UI tests use the real Next.js application and browser, but stub API responses and
  Turnstile callbacks. These tests prove client behavior, not actual server quotas,
  cookies, cryptographic validation, email delivery, or deployment configuration.
- Server/database checks require the actual API and an isolated test database. The
  previous 234-test result is historical evidence, not a new run of this checkout.
- Production/Cloudflare checks are owner-observed release gates, never automated
  probes of live accounts or shared infrastructure.

## Browser coverage

The two suites define 39 test instances across two viewports, giving **78 executions**.
The new regression cases run in TR and EN. Original lifecycle cases run in EN.
Both projects use Chromium with mobile/desktop viewport sizes; this does not prove
real mobile-device behavior or Firefox/WebKit compatibility.

| ID | Scenario / actions | Expected result | Suite |
|---|---|---|---|
| B01 | Fill login/forgot form without a challenge; submit through the form | No API request; submit disabled | Original |
| B02 | Complete challenge, expire it, then submit | Token cleared; no request until another challenge | Original |
| B03 | Complete challenge, trigger provider error | Submit disabled; no password/email operation | Original |
| B04 | Send login/forgot request and receive an API error | Error shown; widget recreated; consumed token not reused | Original |
| B05 | Complete forgot-password successfully | Generic confirmation; challenge removed | Original |
| B06 | Change email with a stale-session response, then sign in | Return to settings; edit dialog closed; no automatic replay | Original |
| B07 | Confirm deletion with a stale-session response, then sign in | Return to settings; user must reconfirm; no automatic deletion | Original |
| B08 | Change email while another tab is open | Both tabs leave authenticated pages; login URL/input contain no email | Original |
| B09 | Start Google sign-in with profile/phone/external return targets | Approved internal target preserved; external target replaced | Original |
| B10 | Receive 429 on login/forgot, then retry | Error visible; fresh challenge required; second token sent | Regression, TR/EN |
| B11 | Submit again while login/forgot response is pending | Exactly one API request; submit remains disabled | Regression, TR/EN |
| B12 | Enter malformed email in login/forgot | Browser validation blocks API submission | Regression, TR/EN |
| B13 | Request reset for known and unknown dummy addresses | Identical generic confirmation; no email in URL | Regression, TR/EN |
| B14 | Edit name with unchanged email written in uppercase | PATCH omits email; session survives reload | Regression, TR/EN |
| B15 | Email change returns 409 | Error stays in dialog; no logout or reauthentication redirect | Regression, TR/EN |
| B16 | Email change returns unrelated 403 | Error stays in dialog; only the explicit reauthentication code redirects | Regression, TR/EN |
| B17 | Open account deletion and cancel | No DELETE request; session remains active | Regression, TR/EN |
| B18 | Open login with reauth/emailchanged reason | Correct localized explanation; email input empty | Regression, TR/EN |
| B19 | Open login with an unrecognized HTML-like reason | Input not rendered as an explanation or executable HTML | Regression, TR/EN |

## Actual API/database scenarios

These must not be inferred from mocked browser success. Existing focused suites cover
many of them; rerun relevant suites against the final source before release.

| ID | Scenario | Expected result / evidence |
|---|---|---|
| S01 | Production request without/wrong edge secret; malformed body | Rejected before body parsing |
| S02 | Valid edge secret with missing/invalid/spoofed connecting IP | Missing/invalid IP rejected; untrusted forwarding headers ignored |
| S03 | Direct origin health/cron requests with method/path/secret variations | Only exact documented exceptions allowed |
| S04 | Auth POST with absent/null/different web/admin Origin | Rejected; correct web/admin origin accepted; OAuth state still required |
| S05 | Alternate web/admin login attempts from the same IP | Shared 10/minute quota; next attempt 429 with positive Retry-After |
| S06 | Wrong and successful password attempts for known/unknown accounts | Shared 10/15-minute account window; success does not reset it |
| S07 | Concurrent requests from two API/storage processes | Atomic quota; no excess admission; restart does not clear stored counters |
| S08 | Denied attempts and expired windows | Denial does not extend expiry; expired window admits again |
| S09 | Forgot-password quota and 60-second gap | No mail when blocked; same generic success; denial does not extend gap |
| S10 | Register/reset/verify/refresh IP thresholds | Configured quotas enforced and 429 response has Retry-After |
| S11 | Missing/wrong-action/wrong-host/reused Turnstile token; outage | Fail closed before password lookup or email work |
| S12 | Missing/invalid Access assertion; signed identity mismatch on login/refresh | No admin session; mismatched rotated refresh family revoked |
| S13 | Session at either side of 10-minute boundary, expired/revoked session | Only active recently created session permits sensitive mutation |
| S14 | Refresh an old session, then email change/self-delete | Refresh does not make authentication recent |
| S15 | Change email with multiple devices/sessions and both token kinds | Email updated, verification cleared, links and every session revoked atomically |
| S16 | Race email change with verification/reset/link creation/login issuance | No stale-recipient verification, reset, email link, or session issuance |
| S17 | Invalid/expired reset token followed by valid final consumption | Invalid input rejected before hashing; locked final check prevents reuse |
| S18 | Read counters as ordinary user vs SERVICE and run maintenance | Ordinary user cannot read/write; FORCE RLS active; expired records purged |
| S19 | Inspect actual refresh-cookie headers and email-change response | HttpOnly/production Secure/host scope/SameSite=Lax retained; cookies cleared |

## Release / owner-observed scenarios

| ID | Scenario | Expected result |
|---|---|---|
| R01 | Cloudflare forwards client-supplied origin-secret header | Rule overwrites the value for the API hostname |
| R02 | Open admin and `/auth/admin/*` without Access, then with approved MFA identity | Access boundary covers both; MFA policy is mandatory |
| R03 | Run release CI including the dedicated dummy-key browser build | No failed/skipped required CAPTCHA cases; diagnostics retained on failure |
| R04 | Observe real provider configuration without abusing live accounts | Correct Turnstile hostname/action, exact HTTPS origins, Render secret alignment |
| R05 | Use the exact production bind hostname/start command and reverse proxy for TR auth/settings and reauthentication | Pages load without repeated 307 redirects; localhost browser success alone is insufficient |

## Commands and evidence

Dedicated build environment: `NEXT_PUBLIC_TURNSTILE_SITE_KEY=qa-dummy-key` and a safe
local API URL. Never substitute real credentials. In an approved isolated runtime:

```text
pnpm --filter @mentor/web build
pnpm --filter @mentor/web test:e2e account-security.spec.ts account-security-regression.spec.ts --workers=1
```

Discovery uses the same command with `--list`; discovery is not a passing browser test.
CAPTCHA cases deliberately skip in ordinary builds without a site key. The dedicated
CI build supplies a dummy key and must execute those cases rather than skip them.

2026-10-08 status:

- Test discovery passed in the isolated Node container: 78 tests in two files.
- **Browser execution passed: 78/78, zero skips, zero retries, one worker, 2.3 minutes.**
  Chromium ran the actual production-mode Next.js application in the isolated loopback
  namespace, using two viewport sizes and the dummy API/provider fixture.
- The profile failure was reproduced before the source fix; six focused profile cases
  passed after the fix, followed by the complete 78-test run.
- Targeted TypeScript passed for both suites and their shared fixture after the edits.
- Targeted ESLint passed for both suites, the shared fixture and the two changed profile
  components. The final scoped `git diff --check` passed.
- With explicit user authorization, the official matching Playwright browser image was
  downloaded: `mcr.microsoft.com/playwright:v1.61.1-noble`, digest
  `sha256:5b8f294aff9041b7191c34a4bab3ac270157a28774d4b0660e9743297b697e48`.
  Project dependencies were reused locally; target execution remained network-isolated.
- The disposable build adapted Windows dependency links for Linux and reused local font
  assets. Type validation was disabled only in that temporary build configuration because
  relocated dependency declarations could not resolve their Windows links. The repository
  Next.js configuration was not changed. This is not a passing full web typecheck/build
  or full CI claim; those remain required against the final checkout before release.
- Both owned containers and the verified QA scratch directory were removed after checks,
  discarding builds, browser diagnostics and copied source. This parent-authored summary
  and repository test definitions are retained; target-generated artifacts are not.
- Do not reuse the previously entered local/live secrets for these test runs.
- No deployment, live provider calls, or production data changes performed.

Related files: `apps/web/e2e/account-security*.spec.ts`,
`apps/web/e2e/helpers/account-security.ts`, `.github/workflows/ci.yml`,
`docs/core/security-release-checklist.md`, `docs/plans/2026-10-07-account-security.md`.

## Findings and fixes

- **Profile edit runtime failure, fixed:** opening the edit sheet raised
  `useAuth must be used within <AuthProvider>`. The root sheet viewport is outside
  AuthProvider, so invoking `useAccountSecurity` from the sheet content crashed the page.
  ProfileHeader now obtains the authenticated callback and passes it into ProfileEditForm.
  The tests monitor uncaught page errors as well as visible state and request counts.
  Related: `profile/_components/profile-header.tsx`, `profile-edit-form.tsx`.
- **Production bind compatibility, needs validation:** in the isolated production server,
  `/giris` repeatedly returned 307 to itself with `--hostname 127.0.0.1`. Its rewrite was an
  absolute localhost URL. With `--hostname localhost`, the same route returned 200 and a
  relative internal rewrite. This was reproduced locally; no Render endpoint was probed.
  Keep R05 open until the actual deployment bind/proxy combination is checked. No framework
  header workaround or deployment change was made in this QA pass.
