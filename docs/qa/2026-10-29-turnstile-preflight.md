# Turnstile launch preflight

Continuation of [free-first launch preparation](2026-10-28-free-first-launch.md).
Status: existing code and focused unit checks passed. After explicit owner approval, one
widget was created and its keys saved to the approved ignored local file. The dummy-secret
probe and real local backend login/replay acceptance passed. Production Next.js/Render
acceptance remains pending. No account API
credential, billing setting or production deployment changed.

## Existing integration

The current application already uses a shared Next.js widget and the NestJS identity module's
Siteverify service. Keep these paths and existing environment names; no new backend, library,
queue or form implementation is needed.

| Surface | Widget action | Existing server-side check |
|---|---|---|
| Signup | `signup` | `AuthService.signup`, default `TURNSTILE_EXPECTED_ACTION=signup` |
| Login | `login` | `AuthService.login`, explicit action |
| Password recovery request | `forgot-password` | `AuthService.forgotPassword`, explicit action |
| Phone verification | `phone-verification` | `PhoneVerificationService`, explicit action; SMS remains disabled |

`TurnstileService` requires literal `success === true`, the configured hostname and the
expected action. It rejects malformed/oversized tokens, non-2xx responses, unavailable
verification and provider-reported replay. Production fails closed if a secret/hostname/action
is missing. The client clears expired/error tokens and removes/recreates its widget after
submission through `resetKey`. No reCAPTCHA/hCaptcha migration is needed in these auth paths.

Existing settings:

- API: `TURNSTILE_SECRET_KEY`, `TURNSTILE_EXPECTED_HOSTNAME`,
  `TURNSTILE_EXPECTED_ACTION`, `TURNSTILE_VERIFY_TIMEOUT_MS`.
- Web build: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- Production hostname must stay exactly `puhukoc.com`; never add local hostnames to the
  production server's accepted hostname. Local acceptance uses its own exact hostname.

## Account and cost observations

On 2026-10-29, the selected `yemres` Cloudflare account's Turnstile page showed the onboarding
view with **Add widget manually** and **Set up with Spin**. No existing widget was listed.
The official Free plan includes 20 widgets, 10 hostnames per widget and unlimited challenges.
No paid feature is needed for the proposed initial integration.

The Spin authorization probe returned `missing_token / no_env_var`. Only presence booleans
were inspected; no credential contents were printed. The canonical helper ran through the
existing external Git Bash after the initial restricted process launch failed. No Wrangler
installation, credential-bearing package resolution or authentication change occurred.
This affects the CLI/API path, not the dashboard path: current
[Spin dashboard documentation](https://developers.cloudflare.com/turnstile/spin/) confirms that
Cloudflare creates the widget server-side and returns the widget sitekey/secret. That path
does not require creating an additional account API token.

The proposed setup is one Managed widget for `puhukoc.com`, `localhost` and `127.0.0.1`,
with server-side deployment-specific hostname/action validation. A root widget hostname also
covers its subdomains; that does not widen the backend's exact hostname check. Hostnames and
any credential destinations must be confirmed before creation/writes. Preserve existing env
names instead of copying the skill's generic `TURNSTILE_SECRET` name.

## Focused verification

Ran the installed local Vitest runner with `vitest.unit.config.ts`:

- `src/modules/identity/application/turnstile.service.spec.ts`: **17 passed**.
- `src/config/env.validation.spec.ts`: **70 passed**.
- Total: **87/87**, exit 0. Provider HTTP is mocked; no actual challenge or Siteverify call.

The first pnpm launcher attempt stopped in Corepack's package-manager lookup because registry
DNS was unavailable; no tests ran in that attempt. The successful invocation used the already
installed test runner and did not fetch/install dependencies. Logs are in the ignored
`.artifacts/deployment/free-first/turnstile-preflight-20261029-offline.log`. This is focused
verification, not full CI or production/browser acceptance.

## Setup sequence and current acceptance

Automatic approval review rejected the click on **Set up with Spin** before execution because
the setup flow may create a widget or account permissions and lacked specific owner approval.
Do not bypass it via another setup path. The current page is retained for handoff; safe proof:
`.artifacts/deployment/free-first/turnstile-setup-before-approval.jpg`.

The owner subsequently explicitly approved opening that exact flow. The dialog initially
preselected the unrelated `ahmetmulayim.com` zone. Removed that unsaved chip and selected only
`puhukoc.com`; no zone or DNS record was changed. The final form now shows widget name
`puhukoc.com (Spin)` and states that `localhost` and `127.0.0.1` are added automatically.
The final **Set up** button initially remained pending. Review proof:
`.artifacts/deployment/free-first/turnstile-widget-review.jpg`.

The owner then explicitly approved creation and saving the widget keypair to
`apps/api/.env.turnstile-acceptance.local` in the original checkout. Created exactly one
`puhukoc.com (Spin)` widget. Its edit page confirms the exact three approved hostnames,
Managed mode and no pre-clearance. Sitekey: `0x4AAAAAAFqO-E80szQMkhne` (public identifier).
The secret was captured privately from the new-widget success card and written only to that
Git-ignored destination with exclusive creation. It was not printed or included in a screenshot.
The file also holds the public sitekey, local expected hostname `localhost` and signup action;
it is not automatically loaded. Main env and production service settings remain separate.
Existing names `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` were preserved.

The official Siteverify dummy-token probe returned HTTP 200, `success=false` and
`invalid-input-response`, without `invalid-input-secret`: the stored secret is accepted.
Observed at **2026-10-29 01:32 TRT / 2026-10-28 22:32 UTC**. This is not proof of an actual
challenge, hostname/action acceptance, successful application request or replay rejection.
No additional account API token, Wrangler installation, paid product or DNS change was needed.
Safe evidence: `.artifacts/deployment/free-first/turnstile-widget-setup.json`,
`turnstile-secret-check-result.json` and `turnstile-widget-created.jpg`.

An isolated local browser diagnostic was prepared with the real Nest app/HTTP controllers,
fresh loopback-only DB, synthetic verified account and actual Turnstile service. Only the
official Siteverify endpoint is allowed outbound; AI/storage are fake and email/SMS/payments
are disabled. The page does not load or render a challenge until its start button is pressed.
Client login fetches use `credentials: 'omit'` to preserve existing localhost browser sessions.
It will compare an actual successful login with replay of the same token, then close the API.
The idle diagnostic expires after 20 minutes; it must not be mistaken for a public service.
Initial fixture preparation failed before any provider request because its seed omitted the
schema-required KVKK timestamp; corrected only the synthetic fixture, preserving the schema.
Two isolated helper regressions passed after reproducing/fixing generated-script escaping and
blocked-rerun result preservation.
The corrected diagnostic reached `ready_for_owner_challenge` with database
`mentor_free_first_turnstile_20261028224434`. A real HTTP login without a token returned 400
before any provider request. Its loopback page at `http://localhost:13721/__turnstile-acceptance`
shows an unpressed start button; no challenge script is loaded until that button is used.
Evidence: `turnstile-browser-20261028224434.json` and `turnstile-local-preview-ready.jpg`.
Actual CAPTCHA completion requires action-time approval or the owner's direct interaction.

## Real backend and replay result

After explicit action-time owner approval, the agent started the local challenge once.
The browser console emitted `300030` twice and reported a hung widget. The API had received
zero login attempts and zero Siteverify calls at that point. Closed the automated test tab to
stop client retries. [Cloudflare's error-code reference](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/)
classifies `300*` as generic challenge failure / bot behavior; the exact browser/environment
cause was not established. No widget/security setting was weakened and no fake token substituted.

The owner then completed the check directly in normal Chrome. The same diagnostic recorded:

| Check | Actual result |
|---|---|
| First Siteverify | HTTP 200; `success=true`; hostname `localhost` and action `login` match |
| Existing `POST /v1/auth/login` | HTTP 200 with the synthetic local account |
| Same token sent to Siteverify again | HTTP 200; `success=false`; `timeout-or-duplicate` |
| Existing login endpoint on replay | HTTP 400 |
| Other outbound server requests | 0 |
| Diagnostic completion | `passed`; process exit 0; API closed automatically |

Completed **2026-10-29 01:55:53 TRT / 2026-10-28 22:55:53 UTC**. Original result:
`.artifacts/deployment/free-first/turnstile-browser-20261028224434.json`. No key, password,
cookie or raw Turnstile token is written to that result. The browser's test fetches omitted
credentials, and the server used its new local DB only. No email or SMS was sent.

When inspected after completion, the owner's page had been refreshed and showed connection
refused because the API had already shut down. Do not treat that later error page as a failed
login or rerun the challenge just to capture a screenshot. The final automated-attempt screenshot
was an unusable blank capture and is not retained as proof; console observations and server
results are recorded separately. This passes the existing Nest backend's real local login and
replay gate. It does not establish production Next.js rendering/CSP, public apex-hostname
operation, signup/recovery delivery or Render cold-start acceptance.

Use only Turnstile-scoped access for the selected account, preserve unrelated resources and
reject paid/broader options. Secret destinations must be Git-ignored and explicitly confirmed;
never print keys, pass them as command arguments or retain them in screenshots/logs.

Actual acceptance must exercise the existing backend with a fresh real token, then reject
replay and wrong action/hostname. A dummy-secret check or provider dashboard alone cannot pass
this gate. Keep deployment, live emails, SMS and paid features under their separate approvals.

Sources checked through current official documentation:
[plans](https://developers.cloudflare.com/turnstile/plans/),
[hostname management](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/),
[server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
