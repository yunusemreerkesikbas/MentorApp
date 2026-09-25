# Mentor QA — 25–26 September 2026 — Local release-gate verification

## Scope and evidence boundary

This run uses the dirty `feature/APP-110` working tree at
`fcb2d8090d48cfb8344852a1e94b31d76c01e781`. The [starting manifest](evidence/2026-09-25-release-gate-snapshot.json)
records the initial uncommitted overlay. W8 coach work continued in the shared checkout during
verification; [the full-test source manifest](evidence/2026-09-25-full-test-source-snapshot.json)
records a later source sample. After the concurrent change was identified,
[the candidate manifest](evidence/2026-09-25-frozen-candidate-snapshot.json) captured the source for
the final local rerun. CI on a committed revision is still required before merge or release.

Local environment: Windows, Node/pnpm workspace, production Next build for browser and budget
checks, isolated `mentor_test` Postgres on port 5433 for API E2E. AI, vision, storage, payment and
email use fake providers. Browser tests create fresh Playwright contexts and disposable accounts;
they do not use a personal Chrome profile. `PASS` below describes only the named local check.
The [25 September browser snapshot](evidence/2026-09-25-final-browser-snapshot.json) records
the dirty source used for that broad run.
On 26 September, the shared checkout moved to `feature/APP-111` (`3055c2ff` at the start of the
follow-up). A React lint finding in `PopoverMenu` was corrected in the dirty checkout; the
[26 September browser snapshot](evidence/2026-09-26-browser-final-snapshot.json) records that
small overlay. The historical 25 September results below remain tied to their stated source.
The [26 September clean browser snapshot](evidence/2026-09-26-browser-clean-snapshot.json)
records HEAD and the three changed browser/source files for the successful rerun; all four values
were unchanged after it. Concurrent APP-111 coach-planning edits appeared in other files during
that run. They were not part of its production build and need a separate validation.

## Gate results

| Gate | Expected | Actual and evidence | Status | Duration |
| --- | --- | --- | --- | --- |
| R01 Static checks | All workspace lint and typecheck tasks pass. | The first 26 September full lint run found a render-time ref access in `PopoverMenu`; after moving dialog discovery to the existing layout measurement, the complete lint and typecheck tasks passed. [Initial failure](evidence/2026-09-25-full-lint-app111.log), [final lint](evidence/2026-09-26-full-lint-app111.log), [final typecheck](evidence/2026-09-26-full-typecheck-app111.log). | PASS locally after fix | See logs. |
| R02 Production build | All packages build from the dirty checkout. | The 26 September candidate completed **8/8 tasks** after the `PopoverMenu` fix. [Current build](evidence/2026-09-26-full-build-app111.log). | PASS locally | 52.3 s. |
| R03 Production budgets | Manifest exists and article, panel, font and message limits all hold. | Article JS 418.0/704 and 957.2/985 KiB; panel JS 754.7/760 and 1293.9/1295 KiB; font 2/2; message scopes 248/1024, 814/2048, 4107/6144 B. [Generated report](evidence/2026-09-26-web-performance-budget-report.json), [check log](evidence/2026-09-26-web-budget-app111.log). | PASS locally; panel total has 1.1 KiB headroom | About 1 s. |
| R04 Full unit/API tests | Full workspace tests pass with fake providers and `mentor_test`. | The 26 September first full API run passed **329/331 files**; forum setup timed out at 90 s and one cohort assertion exposed a UTC/Istanbul test-data mismatch. The fixture was corrected; cohort passed **5/5** and forum **36/36** alone. The full API recheck passed **330/331 files and 2757 assertions**, including cohort, but a Windows Vitest child process exited during the remaining forum file. A two-file thread-pool probe terminated the local Node process, so no pool change was adopted. The current web unit suite passed **795/795**. The [25 September full runs](evidence/2026-09-25-full-tests-final.log) also had worker exits; all missing files passed separately. [First API run](evidence/2026-09-26-api-full-tests-app111.log), [cohort rerun](evidence/2026-09-26-cohort-istanbul-date-rerun.log), [forum rerun](evidence/2026-09-26-forum-startup-rerun.log), [API recheck](evidence/2026-09-26-api-full-tests-recheck.log), [thread probe](evidence/2026-09-26-api-thread-pool-probe.log), [web tests](evidence/2026-09-26-web-new-work-tests.log). | BLOCKED as a single full command by local Vitest process exits; targeted files pass | API 13m 53s + 17m 14s; targeted 38 s + 1m 24s; web 14 s. |
| R05 Production dependency audit | No high or critical production advisory. | `pnpm audit --prod --audit-level high` passed. One moderate `baseline-browser-mapping` advisory remains through Next in web/admin; affected 2.10.34, patched at 2.11.0. [Audit](evidence/2026-09-25-production-dependency-audit.json). | PASS at CI severity gate; P2 follow-up | See audit output. |
| R06 Secret scan | No committed or dirty-worktree secret finding. | Verified Gitleaks scan of the last commit and dirty text paths found none. Two QA hash-manifest false positives were reformatted and rescanned. [Commit scan](evidence/2026-09-25-secret-scan-commit.json), [dirty scan](evidence/2026-09-25-secret-scan-dirty.json). | PASS for scanned ranges | See scan logs. |
| R07 Firefox local smoke | Community and consent UI render in mobile/desktop Firefox. | Four cases failed before navigation at `browserContext.newPage`; a minimal blank-page launch reproduced the same error without the app. [Run log](evidence/2026-09-25-firefox-local-smoke.log), [trace](evidence/2026-09-25-firefox-new-page-failure-trace.zip). No product assertion ran and no screenshot exists. | BLOCKED by local browser tool | About 1m 20s attempted. |
| R08 Deployed security | Access MFA, direct-origin isolation, restricted runtime DB role, R2 private migration and expiry, provider and log controls hold in staging. | No staging URLs, Access QA route or deployment credentials were available in this checkout. The [release checklist](../core/security-release-checklist.md) names these checks. Local Stage 1 evidence does not establish deployed policy. | BLOCKED | Not run. |
| R09 Browser release matrix | Current build passes Chrome, Firefox and real Safari, including auth and private media. | The 26 September clean Chromium rerun passed **547/547 runnable** cases, with **69 conditional skips** and no failures; the captured HEAD and three changed-file hashes did not drift. The earlier focused installed-Chrome run passed **80/80**. Installed Chrome against the real API passed **6/6** community, coach-link and admin cases across mobile and desktop. Firefox has the local tool failure above; real Safari requires an Apple browser environment. Concurrent coach-planning edits after the production build require their own validation. [Clean broad run](evidence/2026-09-26-full-browser-clean.log), [source snapshot](evidence/2026-09-26-browser-clean-snapshot.json), [focused Chrome](evidence/2026-09-25-installed-chrome-stable-scope.log), [real API desktop](evidence/2026-09-25-stage4-all-real-chrome-desktop.log), [real API mobile](evidence/2026-09-25-stage4-all-real-chrome-mobile.log). | PASS for tested build in Chromium and Chrome; release matrix BLOCKED by Firefox/Safari, staging and newer unbuilt edits | Broad 14m 6s; focused Chrome 5m 18s; real API 14.2 s + 10.1 s. |

### Browser findings and corrective checks

| ID | Expected | Actual and evidence | Status | Duration |
| --- | --- | --- | --- | --- |
| B01 Coach plan recurrence on mobile | The repeat menu stays above the fixed submit bar and accepts a choice. | The original mobile click was intercepted by the bar; [screenshot](evidence/2026-09-25-mobile-coach-event-repeat-blocked.png) and [trace](evidence/2026-09-25-mobile-coach-event-repeat-blocked-trace.zip) preserve the failure. The shared plan menu now opens upward; targeted browser tests passed. | FIXED, targeted PASS | See targeted log. |
| B02 Native dialog menu and mobile notebook tools | Subject and sticker menus accept pointer input; the mobile toolbar stays reachable. | Portaling the menu into the open native dialog, placing it above the vision-board drawer, and raising the notebook rail resolved the blocked controls. Affected mobile tests passed **9/9**. [Targeted run](evidence/2026-09-25-mobile-fix-targeted.log), [notebook confirmation](evidence/2026-09-25-notebook-final.log). | FIXED, targeted PASS | See logs. |
| B03 Journey celebration keyboard focus | Once the spotlight animation settles, its action receives focus; closing returns focus. | The 4.5 s animation competed with Playwright's 5 s default assertion timeout under load. A 616-case Chromium run reached **545 passed, 69 skipped, 2 failed**, both on this focus wait; an 18-case repeat passed 17 and failed once at the same wait. The initial focus waits now allow 10 s; **30/30** repeated cases and the **547/547** broad rerun passed. [Broad diagnostic](evidence/2026-09-25-full-browser-mobile-fix.log), [repeat before](evidence/2026-09-25-journey-focus-repeat.log), [repeat after](evidence/2026-09-25-journey-focus-fixed.log), [final broad](evidence/2026-09-25-full-browser-final.log). | TEST TIMING FIXED, PASS in targeted and broad reruns | Broad 13m 18s; targeted repeat 1m 42s; final broad 10m 24s. |
| B04 Ads reward confirmation | Completing an ad announces the earned reward and shows the current quest state. | The completion toast was missing. The panel now shows the localized success toast; the targeted ads flow passed **8/8** in browser. [Ads scope](evidence/2026-09-25-browser-feedback-final.log). | FIXED, targeted PASS | 14.6 s. |
| B05 Real API Chrome paths | TR/EN community, consent-controlled coach link, private-read revocation, admin role gate and cookie-only admin session work on mobile and desktop. | All three scenarios passed in both installed-Chrome projects (**6/6**). The signup fixture initially hit a genuine 429, so it now waits out that rate window; its `beforeAll` timeout covers the wait. The final runs used disposable accounts and restored `forum.enabled`, `mentorship.enabled` and `mentorship.seats.sponsorship_enabled` to `false`. [Desktop](evidence/2026-09-25-stage4-all-real-chrome-desktop.log), [mobile](evidence/2026-09-25-stage4-all-real-chrome-mobile.log), [admin mobile screenshot](evidence/2026-09-25-stage4-admin-mobile-chromium.png), [coach roster screenshot](evidence/2026-09-25-stage4-roster-mobile-chromium.png). | PASS locally with real API | 14.2 s + 10.1 s. |
| B06 26 September menu and notebook regression | Dialog menus, plan recurrence and vision-board choices remain clickable after the lint fix; notebook create navigates after a successful save. | An installed-Chrome 28-case run reached **26 passed, 1 skipped, 1 failed**: a notebook POST returned 201 and its detail RSC returned 200, but the 5 s URL wait expired while local image optimizer requests took about 4.8 s. The isolated case passed **3/3**, then **8/8** with two workers. The URL wait now allows 10 s; the full menu scope passed **27/27 runnable**, with one conditional skip. [Initial run](evidence/2026-09-26-popover-chrome.log), [repeat](evidence/2026-09-26-notebook-create-load.log), [final scope](evidence/2026-09-26-popover-chrome-final.log). | TEST TIMING FIXED, targeted PASS | Final scope 3m 30s. |
| B07 Editorial calendar boundary | The English article and hub render their localized content; future official events may offer an ICS link, while past events are filtered by the API. | The 26 September broad diagnostic passed **545**, skipped **69**, and failed **2** copies of one assertion: it expected no calendar link from the browser fixture's past event, but the server fetched the isolated database's future **30 December 2026** event. Browser route mocks do not control that server request. The unrelated link assertion was removed; API `selectNextEvent` tests cover past filtering. The full knowledge browser scope passed **22/22** and the broad browser rerun passed **547/547 runnable** afterward. [Diagnostic](evidence/2026-09-26-full-browser-final.log), [targeted rerun](evidence/2026-09-26-knowledge-final.log), [clean broad rerun](evidence/2026-09-26-full-browser-clean.log). | TEST FIXED, targeted and broad PASS | Diagnostic 15m 6s; targeted 20 s; broad 14m 6s. |
| B08 Coach plan evidence at the Istanbul day boundary | A pending task on the local current day is excluded from missed-task completion; a completed task counts. | The API service uses `todayInIstanbul`, while the E2E fixture had created plan rows from UTC `todayIso`. Between 21:00 and 23:59 UTC that made the pending row yesterday and produced **1/3** instead of **1/2**. Plan-row fixtures now use the local date; streak fixtures still use UTC. The focused test passed **5/5** and the full API recheck passed that file **5/5**. [Initial failure](evidence/2026-09-26-api-full-tests-app111.log), [focused rerun](evidence/2026-09-26-cohort-istanbul-date-rerun.log), [full recheck](evidence/2026-09-26-api-full-tests-recheck.log). | TEST DATA FIXED, targeted and full-file PASS | Focused 38 s; full recheck 17m 14s. |

### Deployed control checklist

These are explicit release checks, not passes inferred from localhost. None was attempted without
the staging host or its Access-protected QA path.

| ID | Expected in staging | Observed | Status | Duration |
| --- | --- | --- | --- | --- |
| D01 Database | `0102`/`0104` migrations applied; API starts as a non-owner runtime role without `BYPASSRLS`; cross-user reads fail. | Deployment database and role information unavailable. | BLOCKED | Not run. |
| D02 Admin edge | Access protects admin web and `/v1/admin/**`, requires MFA, and direct Render origin rejects unsigned/forged headers. | Staging and direct-origin URLs unavailable. | BLOCKED | Not run. |
| D03 Session revocation | Existing tokens lose authority after suspension, role removal, logout, reset and refresh replay. | Local API and Chrome evidence exists in [Stage 1](2026-09-24-security-performance.md); deployed behavior unobserved. | BLOCKED for staging | Not run. |
| D04 Private media | R2 migration dry-run/apply verified, public copies and cache removed, unauthorized reads denied, signed URLs expire. | R2 staging access and object inventory unavailable. | BLOCKED | Not run. |
| D05 Edge misuse | Turnstile hostname, rate limit, internal push targets, MIME/size/replayed upload tickets fail safely. | Local tests exist in Stage 1; deployed edge controls unobserved. | BLOCKED for staging | Not run. |
| D06 Operations | Session/cron rotation, sensitive log review, AI budget ceiling and monitoring alarms verified. | Staging platform configuration and logs unavailable. | BLOCKED | Not run. |
| D07 Cross-browser | Chrome, Firefox and real Safari complete the release flow against deployed API. | Staging unavailable; local Firefox Playwright cannot create a page and no Apple browser is connected. | BLOCKED | Not run. |

## Corrective work and remaining decisions

The rewarded-ad unit and E2E fixtures now enable `economy.enabled` for their grant assertions and
restore the original E2E setting afterward. Three stale web-facing specs were removed from the API
tree. Still-valid analysis navigation assertions now live with the web tests; the removed assertions
referred to functions that no longer exist. The Firefox QA project is opt-in with
`QA_BROWSER_CHANNEL=firefox`; the default CI Chromium projects are unchanged. Related files:
`apps/api/src/modules/ads/application/ads.service.spec.ts`, `apps/api/test/ads.e2e-spec.ts`,
`apps/web/src/lib/analysis-navigation.spec.ts`, and `apps/web/playwright.config.ts`.

No release approval is implied by local passes. Finish the full tests and rerun the browser matrix
for the concurrent coach-planning edits, rerun CI on a frozen commit, patch or accept the moderate dependency advisory,
then execute the deployed checklist and real cross-browser matrix. The staging web/admin/API URLs
and Cloudflare Access QA path are required for the deployed checks.
