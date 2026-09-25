# Mentor QA — 25 September 2026 — Local release-gate verification

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
The [latest browser snapshot](evidence/2026-09-25-final-browser-snapshot.json) records the
dirty source at the start of the final broad run; source hashes must be compared again after it.

## Gate results

| Gate | Expected | Actual and evidence | Status | Duration |
| --- | --- | --- | --- | --- |
| R01 Static checks | All workspace lint and typecheck tasks pass. | Latest full lint completed with zero errors; latest full typecheck passed on the current source. [Lint](evidence/2026-09-25-full-lint-current-source.log), [typecheck](evidence/2026-09-25-full-typecheck-current-source.log). | PASS locally | See logs. |
| R02 Production build | All packages build from the dirty checkout. | The latest candidate completed **8/8 tasks** after concurrent W8 source edits settled. [Current build](evidence/2026-09-25-full-build-current-source.log). | PASS locally | 52.7 s. |
| R03 Production budgets | Manifest exists and article, panel, font and message limits all hold. | Article JS 418.0/704 and 957.2/985 KiB; panel JS 754.7/760 and 1293.8/1295 KiB; font 2/2; message scopes 248/1024, 814/2048, 4107/6144 B. [Generated report](evidence/2026-09-25-web-performance-budget-report.json), [check log](evidence/2026-09-25-web-budget-mobile-overlays.log). | PASS locally; panel total has 1.2 KiB headroom | About 1 s. |
| R04 Full unit/API tests | Full workspace tests pass with fake providers and `mentor_test`. | First run had 8 failed files: three API setup timeouts under concurrent browser load, ads fixtures missing the economy gate, and three obsolete cross-app test files. Five affected API files passed **76/76** after fixture correction; migrated web checks passed **26/26**. The second full run passed web **781/781** and API **2768/2769**; the sole cohort test failed while its source and fixture changed during the run, then passed **5/5** alone. The third run kept the source hash stable and passed web **781/781**, API **2698 assertions in 328 files**, but two Vitest workers exited unexpectedly before the last two files completed. Those two mentorship files passed **78/78** separately. [First run](evidence/2026-09-25-full-tests.log), [second run](evidence/2026-09-25-full-tests-rerun.log), [third run](evidence/2026-09-25-full-tests-final.log), [focused API](evidence/2026-09-25-targeted-api-rerun.log), [cohort rerun](evidence/2026-09-25-cohort-evidence-rerun.log), [worker-loss rerun](evidence/2026-09-25-worker-lost-targeted-rerun.log). | BLOCKED as a single full command by local Vitest worker exits; all observed assertions passed on the stable source | Runs 33m 19s, 13m 27s, 11m 58s; missing files 55.2 s. |
| R05 Production dependency audit | No high or critical production advisory. | `pnpm audit --prod --audit-level high` passed. One moderate `baseline-browser-mapping` advisory remains through Next in web/admin; affected 2.10.34, patched at 2.11.0. [Audit](evidence/2026-09-25-production-dependency-audit.json). | PASS at CI severity gate; P2 follow-up | See audit output. |
| R06 Secret scan | No committed or dirty-worktree secret finding. | Verified Gitleaks scan of the last commit and dirty text paths found none. Two QA hash-manifest false positives were reformatted and rescanned. [Commit scan](evidence/2026-09-25-secret-scan-commit.json), [dirty scan](evidence/2026-09-25-secret-scan-dirty.json). | PASS for scanned ranges | See scan logs. |
| R07 Firefox local smoke | Community and consent UI render in mobile/desktop Firefox. | Four cases failed before navigation at `browserContext.newPage`; a minimal blank-page launch reproduced the same error without the app. [Run log](evidence/2026-09-25-firefox-local-smoke.log), [trace](evidence/2026-09-25-firefox-new-page-failure-trace.zip). No product assertion ran and no screenshot exists. | BLOCKED by local browser tool | About 1m 20s attempted. |
| R08 Deployed security | Access MFA, direct-origin isolation, restricted runtime DB role, R2 private migration and expiry, provider and log controls hold in staging. | No staging URLs, Access QA route or deployment credentials were available in this checkout. The [release checklist](../core/security-release-checklist.md) names these checks. Local Stage 1 evidence does not establish deployed policy. | BLOCKED | Not run. |
| R09 Browser release matrix | Current build passes Chrome, Firefox and real Safari, including auth and private media. | A focused set of ads, knowledge, member-profile and journey tests passed **80/80** in installed Chrome, mobile and desktop, with mocked API responses except public server-rendered routes. The latest full Chromium suite is in progress. Firefox has the local tool failure above; real Safari requires an Apple browser environment. [Chrome run](evidence/2026-09-25-installed-chrome-stable-scope.log). | PARTIAL / BLOCKED | Installed Chrome 5m 18s; full run pending. |

### Browser findings and corrective checks

| ID | Expected | Actual and evidence | Status | Duration |
| --- | --- | --- | --- | --- |
| B01 Coach plan recurrence on mobile | The repeat menu stays above the fixed submit bar and accepts a choice. | The original mobile click was intercepted by the bar; [screenshot](evidence/2026-09-25-mobile-coach-event-repeat-blocked.png) and [trace](evidence/2026-09-25-mobile-coach-event-repeat-blocked-trace.zip) preserve the failure. The shared plan menu now opens upward; targeted browser tests passed. | FIXED, targeted PASS | See targeted log. |
| B02 Native dialog menu and mobile notebook tools | Subject and sticker menus accept pointer input; the mobile toolbar stays reachable. | Portaling the menu into the open native dialog, placing it above the vision-board drawer, and raising the notebook rail resolved the blocked controls. Affected mobile tests passed **9/9**. [Targeted run](evidence/2026-09-25-mobile-fix-targeted.log), [notebook confirmation](evidence/2026-09-25-notebook-final.log). | FIXED, targeted PASS | See logs. |
| B03 Journey celebration keyboard focus | Once the spotlight animation settles, its action receives focus; closing returns focus. | The 4.5 s animation competed with Playwright's 5 s default assertion timeout under load. A 616-case Chromium run reached **545 passed, 69 skipped, 2 failed**, both on this focus wait; an 18-case repeat passed 17 and failed once at the same wait. The initial focus waits now allow 10 s; **30/30** repeated cases passed. [Broad diagnostic](evidence/2026-09-25-full-browser-mobile-fix.log), [repeat before](evidence/2026-09-25-journey-focus-repeat.log), [repeat after](evidence/2026-09-25-journey-focus-fixed.log). | TEST TIMING FIXED, targeted PASS; broad rerun pending | Broad 13m 18s; repeat 1m 42s. |
| B04 Ads reward confirmation | Completing an ad announces the earned reward and shows the current quest state. | The completion toast was missing. The panel now shows the localized success toast; the targeted ads flow passed **8/8** in browser. [Ads scope](evidence/2026-09-25-browser-ads-selector-final.log). | FIXED, targeted PASS | See log. |

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

No release approval is implied by local passes. Finish the full test and Chromium browser runs on
the current checkout, rerun CI on a frozen commit, patch or accept the moderate dependency advisory,
then execute the deployed checklist and real cross-browser matrix. The staging web/admin/API URLs
and Cloudflare Access QA path are required for the deployed checks.
