# Storage spending and monitoring preflight

2026-10-29. Read-only Cloudflare inspection, approved Sentry setup and local privacy fixes.
No bucket/object/R2 token/DNS/CORS/plan/budget setting was changed. With explicit owner
approval, one Sentry project/ingestion credential was created and one synthetic event sent.

## R2 account snapshot

The **yemres** account Overview lists the existing `mentor-public` / `mentor-private`,
empty EU `puhu-s1-public` / `puhu-s1-private`, and unrelated Craftive buckets. No
`puhu-prod-*` bucket is listed. The unrelated buckets/settings were preserved.

- Overview shows 118.63 MB total storage, 63 Class A and 3.37k Class B operations, with
  **USD 0.00** billable usage for its displayed current period (October 7–November 7).
- Billing's R2-filtered view shows USD 0.00 observed/projected usage cost, 0.08 GB-months
  storage, 59 Class A and 3.31k Class B operations. These are separate UI snapshots/rollups;
  do not treat differing operation totals as a synchronized measurement or the instantaneous
  storage size as GB-month consumption.
- Budget Alerts shows one existing **Default budget alert (auto-created)** at **USD 10**,
  with one recipient. It was viewed and left unchanged. It is account-wide notification
  metadata, not a Puhu operating budget, approved spend, or usage stop.

Official Cloudflare documentation says budget alerts do not stop/cap usage and R2 bucket
storage/object counts are unlimited platform limits. No hard account/project invoice stop
was verified in the inspected screens or documentation.

## Application boundary

Existing upload controls enforce one active upload and 100 MiB per user per UTC day,
short-lived single-use tickets, file signatures, duration and per-prefix size limits.
They are useful abuse controls, not a global storage/operation/monthly billing cap.
Public URLs and private signed GET URLs can be read without passing through the API's
upload quota; private URL expiry does not limit how many reads occur before expiration.

For scale only: eight users each using the current daily byte cap for thirty days, with
no deletion, could accumulate approximately **25.17 GB**. This is a synthetic upper-use
example, not measured demand, a monthly free-upload allowance, or an invoice estimate.
Public signup also means eight expected users is not an enforced account-count limit.

The owner elected to **retain file/image uploads in the first release** and will implement
the free-user notebook image quota before launch. The suggested count is 5 or 10 images;
10 currently stored images was recommended, but no final count was selected. That quota
implementation belongs to the owner and is outside this preparation task. No upload feature
was disabled and no quota or production guard was changed.

A community-wide lifetime image-count limit has not been requested or selected. Existing
file-size/rate controls still matter there. Per-user notebook counts reduce storage exposure
but do not bound open signup, other upload surfaces, total storage or repeated GET operations.
The R2 billing-stop gate therefore remains unresolved; retaining the feature is not proof
of a bounded invoice. Do not silently replace production R2 with the fake provider.

## Sentry account and source readiness

After the owner completed login, the **PuhuKoc** organization (`puhukoc`) was inspected.
General Settings confirms **European Union (EU)** data storage. Subscription shows an
automatically provisioned **Business trial, 14 days left**, with the displayed usage period
October 29–November 11, 2026, no billing details/payment method, zero usage and zero additional
spend before acceptance. Trial volumes are not the permanent Developer allowance.

The official pricing guide confirms that accounts which do not upgrade remain on the free
Developer plan after the trial. Developer has no pay-as-you-go extension and drops events
at quota. No paid plan, payment method, additional spend, integration or product trial was
enabled. The paid checkout was inspected but never submitted; its draft pay-as-you-go value
is not an active account limit. The cancellation screen says this trial is not eligible
to be cancelled through that flow; no cancellation was submitted.

With explicit owner approval, the manual **`puhu-api` / Nest.js** project was created with
only Error monitoring; Logging, Tracing, Profiling and Application Metrics were unchecked.
Its EU ingestion connection is stored only in ignored `apps/api/.env.sentry-acceptance.local`.
No management token, repository connection, Seer setup, SDK installation or source upload
was performed. Nothing was copied to Render or a production environment.

The existing source instrumentation and scrubber sent **exactly one error envelope**,
accepted with HTTP 200 and visibly recorded as [PUHU-API-1](https://puhukoc.sentry.io/issues/157123930/).
The event ID is `a9b0854de00d4770bcb38bb883416491`, environment `test`, Events 1 / Users 0.
Only the error code, synthetic request/job UUIDs and allowlisted job name were retained.
Artificial user/context/payload markers and the raw exception message were absent from the
outbound envelope. No database job, email, API server or other provider was invoked.
Sentry derives country/trace display metadata on ingestion (the UI showed country TR and
an error-derived trace ID); this does not establish zero network metadata or enabled tracing.
No spans, Replay, logs, attachments or metrics were sent.

The one live event exposed a non-fatal processing warning: the sanitizer supplied an empty
stack-frame list after excluding this evidence script's path. Sentry retained the error and
discarded that invalid empty field. The source now omits the stack trace when no approved
frames remain; valid source frames are still retained. This was reproduced in a failing
unit test and verified locally after the fix. The current source also passed a no-network
envelope dry run. **No second live event was sent**, so the post-fix provider processing
result is not claimed; the original test event still shows its historical warning.

Pre-send inspection also caught SDK 10.73 defaulting `enableLogs` to true. `instrument.ts`
now explicitly sets it to false, because log envelopes bypass the error-event scrubber.
A real-SDK test intercepted a `log` envelope before the fix, then confirmed none afterward.
Keep Replay, tracing and automatic request/query/payload collection disabled.

Source review found that the queue supplied job ID/name to Sentry but `scrubSentryEvent`
removed them. The scrubber now preserves only a validated opaque job UUID and, alongside
that UUID, an allowlisted notification job name. Unrecognized names are omitted; the UUID
can still locate their job privately. Recipient data, payloads, tokens, arbitrary IDs and
exception messages stay removed. No broader telemetry integration was enabled.

The two meaningful job-context regressions failed before the fix. **24/24** focused privacy,
logger and queue tests passed afterward, together with API typecheck and touched-file lint.
Those unit tests send no Sentry event and do not establish production monitoring or full CI.

After live acceptance and the log/empty-frame fixes, **23/23 tests across five focused suites**
passed (instrumentation, scrubber, logger privacy, heartbeat ownership and phone privacy),
with API typecheck, touched-file lint and diff whitespace checks passing. The SDK log test
uses a longer per-test timeout for its real SDK cold import; all transport sends are stubbed.
Local evidence is under `.artifacts/deployment/free-first/`: `sentry-acceptance-unit.log`,
`sentry-acceptance-{typecheck,lint}.log`, both RED logs, `sentry-live-result.json`, the dry-run
records and `sentry-first-event.png`. No credential value is included in these records.
An independent read-only review of the four scoped source/test files found no blocking
correctness/privacy issues; it did not run tests or make network requests.

Next: retain the owner's notebook-quota work as a separate launch gate and resolve R2 spending
exposure. Complete exact-commit full CI and the isolated Free hosting cold-start/auth/maintenance
rehearsal before publishing. Sentry's local ingestion check does not prove production wiring.
Existing Access, production secret/role and public-HTTPS mailbox gates still apply.

Sources: [R2 limits](https://developers.cloudflare.com/r2/platform/limits/),
[R2 pricing](https://developers.cloudflare.com/r2/pricing/),
[budget alert semantics](https://developers.cloudflare.com/billing/manage/budget-alerts/),
[Sentry trial and plan transitions](https://docs.sentry.io/pricing/),
[Sentry Developer plan](https://www.sentry.help/en/articles/13965037-can-i-set-up-an-on-demand-pay-as-you-go-budget-for-my-free-developer-plan),
[Sentry quota exhaustion](https://www.sentry.help/en/articles/13964891-i-ve-exhausted-my-quota-what-now).
