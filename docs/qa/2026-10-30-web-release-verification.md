# Web handoff and release verification, 2026-10-30

Follow-up: the owner subsequently approved the reviewed social boundary. Its implementation,
fresh review fixes and current local evidence are recorded in
[core-trial social boundary verification](./2026-10-30-core-trial-social-boundary-verification.md).
The observations below describe the earlier web handoff; they are not the final boundary status.

Status: local web checks completed with the limitations below. Social-boundary design is
under owner review; no implementation of that proposal or production publication.

The owner confirmed that concurrent web/design work was complete and asked to resume
web checks. This continues [the backend verification](2026-10-29-core-trial-release-verification.md)
and the [launch review](2026-10-29-launch-readiness-review.md). Preserve their historical
results and limitations rather than interpreting them as checks of later web edits.

## Candidate and isolation

- Initial branch: `feature/APP-122`; HEAD: `e2e9bd734539e7929446e63576169f0c04e0a337`
  plus the owner's existing uncommitted work and the corrections below. During verification,
  another actor switched/committed the shared checkout to `feature/APP-123`, HEAD
  `4bbd4136b9ea23501d44f620bfe197528a02e831` at 00:22:04 +0300. The application source
  fingerprints remained unchanged by that operation. This agent made no commit/push or
  branch change; the later documentation/skill update remains separate pending work.
- Evidence: `.artifacts/deployment/release-web-1793306560195/` (ignored local diagnostics).
  Initial manifest: 4,700 files. Final manifest additionally includes `render.yaml`, which
  the initial manifest did not select; that addition alone is not a product-source edit.
- Node 22.14.0 and cached pnpm 11.1.1 on Windows. Deployment pins Node 22.22.0;
  a clean Linux/frozen-install CI run on the exact reviewed commit is still required.
- Ordinary web and CAPTCHA builds use `.next/release-web-handoff` and
  `.next/release-security-handoff`. Admin uses `.next/release-admin-handoff`.
  Build commands invoke Next directly: Turbo's strict environment filtering does not forward
  the QA output-directory settings. No performance threshold was changed for these checks.
- Next-added QA type includes were removed only after asserting that all other parsed
  TypeScript settings matched the pre-run backups; the exact original bytes were restored.
- Local API owns port 3001 and a newly created `mentor_release_browser_1793306738822_test`
  database on loopback Postgres port 5433. Listener ownership and readiness were verified.
  AI, vision, storage and payment adapters are fake; mail/provider credentials are empty,
  SMS is disabled and a TCP preload rejects non-loopback API connections. This ordinary
  browser fixture uses development/test mode and is **not** acceptance of the real
  closed-admin production profile. No real mail, AI call, payment or cloud write is intended.
- The previous local development API watcher was stopped after verifying its exact process
  chain. It is not automatically restarted with real configured providers/queues.

## Corrections and RED/GREEN evidence

1. **Overlay auth context.** Shared provider-owned modal viewports were outside
   `AuthProvider`, so the authenticated plan preview crashed with `useAuth must be used
   within <AuthProvider>`. Auth now wraps the toast/dialog/sheet providers themselves.
   Locale context remains above auth; authentication/session semantics are unchanged.
2. **Paginated notebook quota.** A first page containing the system notebook plus eleven
   custom notebooks overwrote the server's total of twelve. Keep the authoritative API
   limits; the desk's loaded-card count remains a separate presentation value.
3. **Touch height.** The quota upgrade button measured 28px in both browser projects.
   Added the existing `min-h-11` token class; its regression now requires at least 44px.
4. **Fixtures.** Notebook deletion now updates the mock overview/list after DELETE, matching
   the app's server-authoritative refresh. SMS-off checkout selectors use the current exact
   TR/EN trial CTA while preserving the `useTrial` and no-SMS assertions. English ad consent
   checks assert the current disclosure and retain the absence of a separate ad choice.

The initial focused run reproduced four mobile/desktop quota/plan failures. After the root
fixes, a broader selection exposed eight stale fixture/copy failures. Those were diagnosed
and corrected, yielding **40/40** focused passes. A separate touch-target RED run failed
both projects at 28px; the final focused/screenshot run passed **4/4**. The rejected
Playwright `--screenshot` CLI attempt ran no tests; successful screenshots came from an
ignored config that extends the actual repository config with `screenshot: "on"`.

Independent source review found no blocking issue in the product corrections. It did not
execute tests or certify the whole repository. The corresponding feature timelines are
in `web-shell.md`, `coaching.md` and `deployment.md`.

## Verification ledger

| Check | Result | Evidence / practical limit |
| --- | --- | --- |
| Workspace lint and typecheck | 21/21 Turbo tasks passed | `workspace-quality.log`; existing warnings remain, including 15 web ESLint warnings, zero web errors. |
| Non-API workspace tests | 5/5 Turbo tasks passed | `workspace-non-api-tests.log`; web Vitest: 164 files, 1,056 tests passed, plus script/package checks. |
| API, ordinary web, CAPTCHA web and admin builds | Passed | `api-build.log`, `web-final-build.log`, `web-security-build.log`, `admin-build.log`. Admin's accepted template type-check deviation remains; workspace typecheck passed separately. |
| Web performance budgets | Passed, unchanged thresholds | `performance-budgets.log`; article 349.1/891.6 KiB attributable/total, dashboard 650.3/1192.8, landing 353.3/895.8; two article font preloads. Byte budgets do not prove hosted Core Web Vitals. |
| Production dependency audit | Policy passed | `audit.json`: critical 0, high 0, moderate 4, low 2. No dependency or lockfile change. |
| Deployment configuration checker | Passed | `deployment-check.log`; validates the retained optional-paid Blueprint, not authorization to apply it or proof of a Free production setup. |
| Candidate commit and pending diff/new text secret scans | Passed | Redacted Gitleaks scan of `e2e9bd73..4bbd4136` (one commit, 437.23 KB), plus the pending tooling/new-text patch (2.03 MB); no new exclusions. Existing full-history/current-source findings retain the dispositions in the earlier backend report. |
| Full ordinary browser suite | Exit 1; scoped correction verified below | 1,402 cases: 1,272 passed, 126 skipped, three flaky and one failed. `full-browser.{json,log}` preserves the complete run; this is not reported as a clean full-suite pass. |
| Blog fixture correction | 22/22 passed without retries | `knowledge-green.{json,log}`; the anonymous blog index legitimately requests `/ads/public/placements/knowledge.index`. The fixture handled only the authenticated endpoint. Added the explicit disabled public response and retained unexpected-request assertions. Owned-file ESLint passed. No product source changed. |
| Flaky-case replay | 24/24 passed without retries | `flake-replay.{json,log}`; three repetitions on both projects cover coach follow-up visibility refresh, spotlight motion states and the 41-minute custom session. The initial failures remain recorded; this replay does not establish a specific root cause or erase flakiness. |
| Dedicated CAPTCHA/security browser suite | 90/90 passed, zero skips/flaky | `security-browser.{json,log}`; separate dummy-key build, single worker, mocked provider calls. Hosted Turnstile/mail acceptance is still separate. |

The final API/shared fingerprint still equals the earlier final HTTP verification:
`8bef2ad95d08ceedd1193ac93f4ed36ddcb5ed46800e23d0a6fec1e77be5b629`.
That permits attributing the recorded backend results to unchanged backend/shared source;
it does not turn the earlier partitioned unit evidence into a clean single full-CI run.
After browser completion the source comparison found only the seven original web
corrections and the later `knowledge.spec.ts` fixture delta against the handoff snapshot
(plus the initially unselected, unchanged `render.yaml`). API/shared source still matched
the recorded fingerprint. No independent application edit was found in that comparison.

The blog fixture correction follows the frozen `4bbd4136` application candidate and remains
uncommitted. It changes test data only; no whole-workspace/full-browser rerun is claimed
after it. GitHub run `40957272347` for `4bbd4136` was still in its Test step at the last
observation; install, audit, deployment check, secret scan, lint, typecheck, build and web
budgets had passed. It does not include the later fixture/doc/tooling changes.

The owner asked to review the proposal before implementation and requested screen examples.
Unedited browser captures of the current local mocked states identify the dashboard
community/coach/trial entry points, focus-room/buddy blocks, another user's follow/buddy
actions and the settings `Koçum` link. These illustrate the locations; they are not hosted
closed-profile acceptance. The additional settings capture passed after correcting the
capture helper's assumed heading (`Ayarlar`) to the observed `Koçum` link. No application
code was changed for screenshots. Only the owned temporary API process was stopped after
all checks/captures; the isolated database and diagnostics were retained. The previous
development API was not restarted automatically.

## Scoped UI audit and detector dispositions

Implementation integrity passes for the inspected notebook desk and shared-overlay changes:
the physical notebook/Puhu identity follows the existing product/design brief. It is not
grounds for replacing the owner's chosen visual direction. Provisional bounded-scope score:

| Dimension | Score | Evidence / limit |
| --- | ---: | --- |
| Accessibility | 3/4 | Semantic controls and existing keyboard/reduced-motion regressions; no complete screen-reader, zoom or contrast certification. |
| Performance | 3/4 | Production build and byte budgets pass; no hosted field metrics or low-end frame profile. |
| Theming | 3/4 | Existing light/dark tokens retained; screenshots cover selected states, not all theme combinations. |
| Responsive behavior | 3/4 | Mobile/desktop renders and corrected 44px control; no physical-device gesture acceptance. |
| Implementation integrity | 4/4 | Corrections preserve server authority, provider scope and the approved physical desk identity. |
| Total | 16/20 | Good within this inspected scope; not a whole-product accessibility/performance certificate. |

Resolved findings: the modal crash and inaccurate quota were functional blockers; the
28px quota target violated the app's 44px design rule and is fixed. No open visual P0/P1
finding is established by this bounded inspection. Continue hosted performance/accessibility
acceptance before release; avoid claiming evidence that the local captures do not provide.

Hook findings were reviewed in context; no ignore comment/config/value was added:

- `layout-transition`, `globals.css`: coordinated 200ms sidebar width/content padding
  changes implement the documented collapsible sidebar, with reduced-motion handling.
  They necessarily resize the content. No frame regression was demonstrated; low-end
  profiling remains unperformed. Do not relabel the accepted behavior as a measured defect.
- `bounce-easing`, line 942: `mentor-puhu-bounce` is the approved 2-second, 5px Puhu idle
  presence cue from `DESIGN.md`, using `ease-in-out` and a reduced-motion alternative.
  The animation name is not evidence of an elastic/overshooting easing curve.
- `broken-image`, `e2e/notebook.spec.ts`: the literal image tag is in a regression-test
  comment about an old implementation, not rendered product markup. The test's R2 URL is
  mocked. No broken production image was established by this hit.

After the owner's explicitly approved skill update, the scoped 4.8.0 detector completed
with exit 0 and only the Puhu-name advisory above. Its first attempt used a nonexistent
`[locale]/globals.css` path and was incomplete; only the corrected run targeting
`src/app/globals.css` is counted. Existing hook hits are not silently suppressed.

## Impeccable update

The previous skill announced an update and required asking once while continuing work.
The owner answered **Güncelle**. Official npm package metadata identified version 4.8.0
and `pbakaus/impeccable`; the project updater completed with `--project --no-hooks --yes`.
It updated the existing .agents/.claude/.cursor/.github installations and installed their
agent/engine assets. No global update or hook-ignore change was requested.
The old .agents skill was backed up locally. `AGENTS.md`, `DESIGN.md`, `PRODUCT.md`,
`package.json` and `pnpm-lock.yaml` matched their immediately pre-update backups byte for
byte. The update does not imply a redesign or dependency change to the application.

## Public domain and remaining release gates

On 2026-10-30, public DNS A/AAAA/CNAME queries through 1.1.1.1 returned no application target
for `puhukoc.com`, `www.puhukoc.com` or `api.puhukoc.com`; web fetches were unavailable.
This confirms no reachable application from these checks, not a domain-ownership failure.
The selected canonical domain remains `puhukoc.com`. Existing mail/provider-account facts
in the earlier launch review were not reverified by this local suite.

1. **Core-only social boundary is incomplete.** `forum.enabled=false` closes forum services,
   but the follow controller/service, buddy controller/service and public profile read do
   not share that gate. Invite redemption can also create buddy/follow relations. Study
   rooms have a separate `coaching.study_rooms.enabled` gate that must be explicitly off.
   `SessionService.start` nevertheless accepts an existing room membership via `roomId`
   without checking that flag, so the flag alone does not close all room participation.
   Leaderboards and achievements have separate flags. Do not claim “community closed” from
   the forum flag alone; prepare/review a complete server-side boundary and matching UI
   behavior before admitting trial users. Personal progress/summary data must remain usable.
   Existing buddy first-session notifications and room notification-target resolution also
   need gating before delivery-deduplication writes. A link-only fix is insufficient.
   The owner chose **review the design together** rather than approving implementation:
   [proposed boundary](../plans/2026-10-30-core-trial-social-boundary-design.md).
2. Freeze/review one commit and pass complete Linux CI, including ordinary and dedicated
   security browsers. Local Windows builds and partitioned API results have stated limits.
3. Prepare a dedicated trial DB, separate runtime/migration roles, verified persisted flags
   and future official calendar/editorial data. Keep admin, AI, payments, SMS and ads off;
   no hosted profile has been activated by this work.
4. Resolve aggregate upload/read/operation spending controls. Per-user notebook quotas and
   expected eight users are not a shared R2 invoice cap or a reserved-upload cap.
5. Rehearse Free hosting sleep/wake, scheduled maintenance, public HTTPS auth/Turnstile and
   actual mail Inbox delivery, private media access, Sentry receipt, recovery and compatible
   closed-mode rollback. Prepare scoped support/incident procedures without an admin UI.

There was no deployment, DNS or provider-account write, billing acceptance, real delivery,
credential test against a provider, new secret-scan exclusion, commit, push or history rewrite.
