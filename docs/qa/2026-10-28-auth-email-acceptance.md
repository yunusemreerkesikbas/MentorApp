# Local auth email acceptance

Part of the [free-first launch preparation](2026-10-28-free-first-launch.md).
Status: local API/queue acceptance passed first with provider HTTP mocked, then with two
explicitly approved real Resend messages. Resend marks both Delivered. The owner confirmed
verification in Gmail Inbox and password reset in Spam. Inbox acceptance is therefore **partial /
failed for password reset**, not complete. Render cold-start and production/browser acceptance
remain open.

## Defect corrected

The HTTP request's language was resolved by Nest, but verification/reset jobs omitted it.
The delivery adapter therefore selected Turkish, and every auth link used a Turkish path.
Five regression cases reproduced the missing locale. `AuthService` now captures the request
locale in the job, alongside a matching link, through `auth-email-variables.ts`:

| Language | Verification link | Reset link |
|---|---|---|
| Turkish/default | `/eposta-dogrula` | `/sifre-sifirla` |
| English, including `en-US` | `/en/verify-email` | `/en/reset-password` |

The existing web routes already define these paths. Existing queued jobs without a language
continue to use Turkish. Token lifetime, one-use consumption, send-time guards, signup admission
and production security validation were not changed.

## Local diagnostic result

Ran the actual Nest test harness, HTTP controllers, request-language resolver, PostgreSQL
migrations, repositories, automatic ten-second queue poller, send-time guard, routing adapter,
Resend renderer and real TR/EN copy. Only the provider HTTP response was mocked; a strict
outbound allowlist prevented actual external requests. Database:
`mentor_free_first_auth_dry_20261028144431`, loopback port 5433, isolated synthetic account.

| Check | Observed result |
|---|---|
| Signup with English request language | 201; verification job/copy/link in English |
| First verification delivery | 10,087 ms after poller start, below the unchanged 180-second lifetime |
| Verification / token replay | 200 / 400 |
| Reset request with Turkish language | 200; reset job/copy/link in Turkish |
| Password reset / token replay | 200 / 400 |
| Old password / old access session | Both rejected with 401 |
| Replacement password | Login 200 |
| Email jobs | Exactly two completed |

Focused auth/security/token/admission/delivery tests: **74/74 passed**. API TypeScript check
and lint of the three touched source/test files passed. Full workspace CI was not run.
The ignored diagnostic and secret-free result are under `.artifacts/deployment/free-first/`:
`auth-email-acceptance.cjs` and `auth-email-mentor_free_first_auth_dry_20261028144431.json`.
Passwords, cookies, raw auth links/tokens and provider credentials are not written to evidence.
The isolated database's normal queue payloads temporarily contain the one-use links; both were
consumed by the test. They must not be promoted to production or mistaken for live user data.

## Real-provider result

After explicit owner approval, ran `--live` on 2026-10-28, 14:58:03–14:58:37 UTC, against the
new loopback-only database `mentor_free_first_auth_live_20261028145803`. The existing private
local sending key sent exactly two messages from `noreply@puhukoc.com` to
`erkesikbasyunusemre@gmail.com`:

| Template | Language/subject | Resend message ID | Provider / owner-reported Gmail result |
|---|---|---|---|
| Verification | English; `PuhuKoç: Confirm your email` | `01a18305-08b8-7908-a791-a31f3b25d412` | HTTP 200; Delivered / Inbox |
| Password reset | Turkish; `PuhuKoç: Şifreni yenile` | `01a18305-2f4e-72bf-be2e-7ba009e8c2fd` | HTTP 200; Delivered / Spam |

The actual local API flow again passed signup 201, verify/reset 200, both replay attempts 400,
old password/session 401 and replacement-password login 200. Exactly two mail jobs completed;
verification wait was **10,551 ms**, below the unchanged 180-second token lifetime. The test
automatically consumed the links and changed only its synthetic local account's password.
The API closed normally and the process exited 0. The owner does not need to click the emails.

A persisted one-shot reservation and per-template attempt guard prevent duplicate diagnostic
sends. A separate temporary-file regression check reproduced and corrected a result-preservation
bug on blocked reruns: the rejected invocation now retains the previous evidence and stops at
preflight, before any credential read, DB connection or provider work. It sent no extra email.

Evidence: `.artifacts/deployment/free-first/auth-email-live-result.json`,
`auth-email-delivered.jpg` and `auth-email-once-guard.test.cjs`. Provider Delivered confirms
recipient-server acceptance. The owner's subsequent report establishes Inbox for verification
and Spam for reset. The functional API result remains passed; the reset Inbox gate remains open.

## Spam investigation

Do not infer that Turkish copy caused the classification: the two messages differ in both
language and template. Both carried HTTP loopback links for the isolated test, not the actual
public HTTPS site. This limits the result's usefulness for production deliverability and is a
candidate to investigate, not a proven cause. Root DMARC was not configured at the last DNS
check. Read-only follow-up established the following for the actual reset message:

| Evidence | Observed result |
|---|---|
| Gmail original-message summary | SPF PASS; DKIM PASS for `puhukoc.com`; DMARC FAIL |
| Gmail Spam banner | Similar to messages previously identified as spam; no specific authentication cause stated |
| Resend Insights | Link domain differs from sender (`http://localhost:3000`); missing DMARC; general no-reply sender recommendation |
| Public DNS before correction, Cloudflare resolver | `_dmarc.puhukoc.com` did not exist (NXDOMAIN) |

The missing DMARC policy is a confirmed readiness gap. SPF and aligned DKIM already pass, so
do not replace the existing sending/receiving records or add a guessed SES SPF include.
[Resend's current guidance](https://resend.com/docs/dashboard/domains/dmarc) recommends starting
with `p=none` and validating actual messages before enforcing quarantine/reject. A starter
record is `_dmarc.puhukoc.com TXT "v=DMARC1; p=none;"`; this requests no rejection or quarantine,
does not collect reports, and does not guarantee Inbox placement. Aggregate-report collection
and stricter enforcement need a separate deliberate setup after all legitimate sources pass.
After the owner restored the browser connection, added this single TXT record to the existing
`puhukoc.com` zone at approximately **20:02 UTC on 2026-10-28**. Cloudflare lists it as DNS-only,
TTL Auto, with nine total records (previously eight). Existing Resend CNAME/DKIM and Cloudflare
MX/SPF/DKIM records were retained. A public query through `1.1.1.1` returned exactly one TXT
value, `v=DMARC1; p=none;`, with TTL 300 seconds. A secondary `8.8.8.8` query timed out locally;
it did not establish a conflicting DNS result. No claim of universal cache propagation.

Safe evidence: `.artifacts/deployment/free-first/auth-email-spam-investigation.json` and
`puhukoc-dmarc-published.jpg`. The one-record import file remains at `puhukoc-dmarc-dns.txt`;
it is a reference, **not an instruction to add a duplicate**. Publication does not change the
authentication results of the already received test. Actual new-message DMARC PASS and Inbox
placement remain unverified; no extra message was sent.

Keep the owner's selected `noreply@puhukoc.com` sender. After DMARC is publicly visible and the
real HTTPS web routes are reachable, retest both auth flows with production-domain links and
inspect authentication plus actual mailbox placement. Do not count a mailbox whitelist or
moving the test out of Spam as an application fix. No additional message or paid feature is
authorized by this receipt report. No raw auth links, original MIME or token-bearing screenshots
were saved during this investigation.
Production already requires `APP_URL` to be a public HTTPS origin through
`apps/api/src/config/env-production-locks.ts`; the deployment checker expects
`https://puhukoc.com`. The HTTP loopback link belongs to the isolated local test and is not a
reason to relax this existing production check or to change the auth templates speculatively.

This test deliberately uses test-mode provider fakes for AI, storage and payments/OTP disabled.
It does not establish real Turnstile, Cloudflare Access, production RLS-role safety, browser UI,
Neon resume or Render wake-up. Keep those acceptance gates separate.
