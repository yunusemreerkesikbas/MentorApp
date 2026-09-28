# Mentor QA — 27 September 2026 — Coach seats and AI taste

## Scope and environment

This is a targeted follow-up to the [local release-gate report](2026-09-25-release-gate-results.md),
not a new release approval. Tests used `feature/APP-111` at
`e3a0fa8739ddb1f48ee05be78c6b5f02b6768ac4` plus the uncommitted W8 overlay in the
[57-file source manifest](evidence/2026-09-27-coach-entitlement-source-snapshot.json). All 57
source hashes still matched after the final Chrome run and after the real-API AI test. The new
[QA-owned API test](../../apps/api/test/qa-coach-ai-taste.e2e-spec.ts) has SHA-256
`bdc3f6aa846b0603c4f71fc5b21eb6dc6bc33a5d504ef339c1c75a9826ed4042`.
The W8 overlay was subsequently committed as `30fc896f`; the 57 measured file hashes still
matched after that commit. The run index retains the HEAD observed when the tests ran.
The [run index](evidence/2026-09-27-coach-seat-ai-run-index.json) preserves hashes of local logs;
raw `.log` files are intentionally not checked in.

Environment: Windows, local `mentor_test` Postgres on port 5433, disposable accounts, fake AI,
vision, storage and payment providers. The API suites used the real Nest API and test database.
The installed-Chrome Playwright suite used the local Next development server and mocked API
responses; it is **UI evidence, not a real-API browser result**. No personal browser profile was
used. The test setup migrated only `mentor_test`; the new suite removed its config overrides.

## Results

| ID | Expected | Actual | Status | Duration / evidence |
| --- | --- | --- | --- | --- |
| C01 Coach entitlement and seat rules | Free/paid/self seats, waiting links, expiry and role gates behave as specified. | Seven API unit files passed **95/95** assertions. | PASS | 14.95 s; `2026-09-27-coach-entitlement-unit.log` |
| C02 Coach AI and roster units | Briefs, suggestions and roster respect their gates and data contracts. | Six API unit files passed **53/53** assertions. | PASS | 25.70 s; `2026-09-27-coach-entitlement-ai-unit.log` |
| C03 Real API seat lifecycle | Sponsor cap, expiry, frozen waiting student and disabled sponsorship hold in the database. | `mentorship-seats.e2e-spec.ts` passed **11/11**. | PASS | 29.28 s; `2026-09-27-coach-seats-e2e.log` |
| C04 Weekly brief claim | Concurrent claims do not duplicate the weekly brief. | `mentorship-weekly-brief.e2e-spec.ts` passed **3/3**. | PASS | 3.42 s; `2026-09-27-coach-weekly-brief-e2e.log` |
| C05 Coach daily AI taste | With the flag off, reject; with one free daily use, return a draft and meter the coach; reject a second call and an unrelated student. | New real-API test passed **1/1**. Responses were **403 → 200 → 403** (`MENTORSHIP_AI_DAILY_LIMIT`), then **404** for the unrelated student. One `ai_usage` row belonged to the coach; the student had zero. | PASS for sequential calls | 30.48 s including app boot; `2026-09-27-coach-ai-taste-e2e.log` |
| C06 Web state model | Seat text and state calculation match the UI contracts. | Two web Vitest files passed **29/29**; seven script tests in the web test command also passed. | PASS | 1.42 s Vitest; `2026-09-27-coach-entitlement-web-unit.log` |
| C07 Installed Chrome seat UI | Mobile and desktop show the correct waiting, disabled and sponsorship-off states. | Final warm run: **23 passed, 1 conditional skip, 0 failed**. | PASS for mocked-API UI | 1.5 min; `2026-09-27-coach-seats-chrome-final.log` |
| C08 Targeted static checks | Current API/web source typechecks. | Both package typechecks exited successfully. | PASS for package source | `2026-09-27-coach-entitlement-api-typecheck.log`, `2026-09-27-coach-entitlement-web-typecheck.log` |
| P01 Message payload budgets | Root ≤1024 B, welcome ≤2048 B, article ≤6144 B. | Current TR/EN maximums: **248/1024**, **814/2048**, **4107/6144 B**. | PASS for message scopes only | [measurement](evidence/2026-09-27-coach-message-budgets.json); under 1 s |
| P02 Default production build | `next build` completes at the tested commit. | In an isolated worktree at `28c702e1`, the configured Turbopack build failed with ten `Bitter` font resolver errors (`next/font/google queries have exactly one entry`). Four dependency packages built successfully. The same ten errors recurred with `NEXT_PUBLIC_SITE_URL` set. | FAIL locally; release gate blocked | 1m 21s, then 11 s repeat; `2026-09-27-coach-production-build.log`, `2026-09-27-coach-turbopack-with-site.log` |
| P03 Compiler diagnostic | Determine whether the failure precedes general code compilation. | A separate webpack probe compiled in 63 s and completed TypeScript in 58 s, then stopped during `/tr/join-room` prerender because the isolated worktree lacked required `NEXT_PUBLIC_SITE_URL`. This suggests the P02 font error is specific to Turbopack in this environment; it does not clear the default build gate. | DIAGNOSTIC, incomplete build | `2026-09-27-coach-webpack-probe.log` |
| P04 Webpack diagnostic build | Complete the alternative build with a non-production HTTPS site origin. | With `NEXT_PUBLIC_SITE_URL=https://mentor.example`, webpack compiled, typechecked and generated **104/104** static pages. | PASS for alternative compiler only | `2026-09-27-coach-webpack-with-site.log` |
| P05 Budget checker | Required article/panel/font manifests are readable and all limits pass. | Against P04, `check:budgets` rejected the webpack client reference manifest schema. The default Turbopack build in P02 produced no complete manifest. | BLOCKED; no JS/font budget result | `2026-09-27-coach-webpack-budget-probe.log` |

The first Chrome run had **19 passes, 4 navigation timeouts and 1 skip**. Each timeout occurred
while `page.goto` waited for the cold development server's `load` event, before a product
assertion. The four affected cases passed **4/4** on a warm two-worker rerun; the full warm scope
then passed as C07. Initial and rerun logs are in the run index. No visual defect remained that
required a screenshot. The initially written C05 fixture expected 201 from the invite-code route;
the route correctly returned 200. The expectation was corrected before the passing run.

## Open gates and next check

The isolated production build failed before generating the required route manifests. The
704/985 KiB article, 760/1295 KiB panel and font budgets therefore remain **unverified on this
source**; an unsupported or missing manifest fails the budget gate, rather than counting as zero
bytes. Message scopes passed separately in P01. The prior candidate's panel total had only 1.2 KiB headroom; see the
linked release-gate report. The next local step is to diagnose the Turbopack font resolver,
rerun the configured build with required production environment variables, then run
`check:budgets` on its output.

C05 proves sequential daily enforcement. Simultaneous coach AI requests and a real-API Chrome
flow for this new AI surface remain untested. Full CI, deployed Cloudflare/Render/R2 controls,
Firefox and real Safari also remain release gates. The failed production build is an open
release blocker; the full test plan is not complete.

## Follow-up: dashboard bundle and celebration browser regression

Production budget snapshot: `8380c5d07e0c7e7c20b4a4b55db9f1ce178f0972` on
`feature/APP-111`. Final browser and targeted source-check snapshot:
`c34b465adb255eb52b7c010ad393b821dd97792c` on `feat/qa-dashboard-performance`.
The earlier Linux [CI run](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/36319480394)
compiled the production web app successfully. Its dashboard total was **1,326,206 B**, **126 B**
over the **1,326,080 B** gate; dashboard route code was **774,055/778,240 B**. Article route and
total, font preload and all three message scopes passed. This refines the local P02/P05 finding:
the Windows Turbopack font error remains a local build failure, while Linux CI produced a valid
manifest and found a real dashboard budget failure.

The app-wide shell and dashboard journey card now load celebration scenes on demand. During the
Chrome check, the existing live SSE test exposed a focus defect: React's repeated development
effect setup replaced the original opener with the scene itself, so closing returned focus to the
page body. The scene now retains the opener and cancels a pending focus restore when the effect
sets up again. The test fixture also derives its CORS origin from the selected browser URL, so
the same suite works on the live port 3000 and the default port 3100.

| ID | Expected | Actual | Status | Duration / evidence |
| --- | --- | --- | --- | --- |
| B01 Installed Chrome journey celebration | Open, acknowledge, retry after API error, recover missed SSE, and return keyboard focus on mobile and desktop. | **6/6 passed** after the focus fix. The failure was reproduced with both static and dynamic scene imports before the fix. | PASS for mocked-API UI | 34.2 s; `apps/web/e2e/journey-level-celebration.spec.ts` |
| B02 Installed Chrome achievement celebration | Load the visual on demand, acknowledge once, and keep it closed after reload. | **2/2 passed** in mobile and desktop Chrome with reduced motion. | PASS for mocked-API UI | 7.2 s; same spec |
| B03 Installed Chrome dashboard spotlight | The level card opens its visual on demand and Escape restores keyboard focus to the card. | **2/2 passed** in mobile and desktop Chrome after passing the opener ref through the asynchronous scene mount. | PASS for mocked-API UI | 7.3 s targeted rerun; same spec |
| B04 Installed Chrome CI-regression targets | SSE focus and coach next/back navigation work at both viewport sizes without waiting for all network traffic to stop. | Final targeted run: **8/8 passed** across mobile and desktop, two repeats each. The coach page remained interactive even when the next route was not prefetched. | PASS for mocked-API UI | 31.5 s; `coach-student.spec.ts`, `journey-level-celebration.spec.ts` at `6afb5f2f` |
| P06 Targeted web checks | Changed source and test compile and lint. | Web TypeScript check, five-file ESLint and diff check passed. | PASS for targeted scope | Local command results; under 1 min each |
| P07 Production bundle gate | Dashboard total ≤1,326,080 B; all other declared budgets pass with a valid manifest. | At `3157d6dd`, the production build and budget artifact passed: dashboard **1,293,788/1,326,080 B** total and **741,637/778,240 B** route code; article **987,569/1,008,640 B** total and **435,418/720,896 B** route code; 2/2 font preloads and message scopes **248/1024**, **814/2048**, **4107/6144 B**. No budget violations. | PASS for latest production-source snapshot | [CI run and artifact](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/36338113134) |
| P08 Full CI browser gate | Production web tests have seeded server data and complete without browser errors. | The pre-fix PR run passed **569**, skipped **63**, and failed **20** browser cases. The seeded API snapshot passed **588** and the local-font snapshot **590**, each with 63 conditional skips. At `3157d6dd`, a notebook test failed because it read an empty draft save. At `6d8b64c6`, **590 passed, 1 flaky, 63 skipped**: coach history anchor moved 72.75 px on the first attempt and passed on retry. The report-only `a7f0cb27` run passed **591**, skipped **63**, and had no flaky case in **11.7 min**. Both coach-test commit `570f509f` runs passed **591** with **63** conditional skips and no flaky or failed case; the first took **12.0 min** in Chromium, with web unit tests **804/804** and API unit tests **2827/2827**. The report-only `a3488610` run had **590 passed, 1 failed, 63 skipped** because an analysis test's third page never received its document response. After the test change, `c8066e8d` passed **591**, skipped **63**, and had no flaky or failed browser case in **14.4 min**. The `ec555b39` report-only run was green but had **590 passed, 1 flaky, 63 skipped** because a knowledge empty-state locator matched a hidden and a visible heading; its retry passed. After the selector fix, `52a06411` passed **591**, skipped **63**, with no flaky or failed browser case in **12.3 min**. | PASS at `52a06411` | [pre-fix run](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/36323269562), [notebook failure](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/36338113134), [analysis failure](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/36397311926), [flaky head CI](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/36410189219), [clean head CI](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/36413262514) |
| P09 Local real-API knowledge Chrome | Server-rendered article and hub content load from seeded API in mobile and desktop Chrome; browser interactions remain mocked where specified. | **20/22** passed on the cold development server. Both composer-navigation cases reached an unfinished Next route request during first compilation; the same two passed **2/2** on a warm rerun. The production CI run with seeded API passed its whole Chrome suite, including the knowledge cases. | PASS on warm dev server and production CI at `6afb5f2f` | `knowledge.spec.ts`; 1.2 min cold run, 7.7 s targeted rerun; local Playwright traces and [passing CI run](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/36336623060) |
| P10 Repeatable production build | A fresh Linux build creates the production manifest on the first attempt. | At `6afb5f2f`, CI attempt 1 stopped at Next 16.3.4's `next/font/google` Turbopack resolver (`Merriweather`); build, budgets and browser steps were skipped. The same source built and passed budgets on CI attempt 2. Commit `d8837761` replaced the ten board-only Google font calls with locally bundled faces; its build and four later Linux builds passed budgets on their first attempts. | PASS for five fresh Linux builds | [old CI attempts](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/36336623060), [local-font CI run](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/36337645976), [latest clean CI](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/36394749684), [related upstream report](https://github.com/vercel/next.js/issues/97344) |
| P11 Board font assets in installed Chrome | Board font choices use local files and render Turkish glyphs at mobile and desktop sizes. | Variable Bitter and fixed-weight Poppins loaded Turkish glyphs through `document.fonts` **2/2**; observed WOFF2 requests all used the local origin. The existing goal-save browser case passed **2/2**. Editor and PNG export now share font-family values; web typecheck, two unit cases and targeted lint passed. The local-font production build and final full Chrome suite succeeded. | PASS for local UI and Linux CI | `vision-board.spec.ts`; 5.2 s font run and 11.5 s goal-save run; [final CI](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/36340513023) |
| P12 Notebook note persistence in Chrome | A typed note eventually persists; an empty second note does not appear in the final page document. | The `3157d6dd` trace captured an empty draft PUT before the text was typed; the test read that first mock save. The API's text schema requires a non-empty string, so the mock accepted a payload the API would reject. The test now waits for the latest saved document containing the typed note, then a later save after the empty note is removed. Installed Chrome passed **4/4** across mobile and desktop, two repeats each, on a warm development server, then **2/2** at the default timeout. The notebook case passed in both later production CI runs. | PASS locally and in production CI | `notebook.spec.ts`; 26.9 s repeated run and 18.3 s final run; [failed trace](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/36338113134), [clean CI](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/36342168725) |
| P13 Coach history scroll in Chrome | Older messages prepend in order and the visible anchor returns to within 20 px after scroll restoration. | The `6d8b64c6` desktop CI case measured a transient **72.75 px** shift before the scheduled animation frame and passed on retry; `a7f0cb27` passed first try. The test now polls the anchor after restoration, leaving a lasting shift as a failure. Its CORS fixture derives the origin from the selected local browser URL. Installed Chrome passed **6/6** across mobile and desktop, three repeats each; both viewport cases passed in the `570f509f` production browser suite. | PASS locally and in production CI | `coach.spec.ts`; 29.5 s targeted run; [flaky CI log](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/36340513023), [passing CI](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/36394749684) |
| P14 Analysis empty states in Chromium | Empty, first-exam and no-focus views render across mobile and desktop without a stalled navigation. | At `a3488610`, desktop's third full page navigation stalled twice at the document request until the 90 s test timeout; the two earlier pages and their prefetches remained open. The screenshots show the earlier pages rendering, and both traces show no response for the third document. The test now closes each prior page before opening the next. With the production web build and matched mock API origin, targeted Chromium passed **4/4** across mobile and desktop, two repeats each; an additional **6/6** test cases passed before the Windows-managed web server delayed process exit. Web typecheck and targeted lint passed. Both viewport cases passed in the `c8066e8d` full production browser suite. | PASS locally and in production CI | `analysis.spec.ts`; 20.0 s completed local run; [failed CI and trace artifact](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/36397311926), [passing CI](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/36401625171) |
| P15 Knowledge empty-state heading in Chromium | The empty family and past-last-page headings are visible and uniquely identifiable in mobile and desktop views. | At `ec555b39`, mobile Chromium initially found two matching headings, one hidden and one visible; Playwright's text locator failed strict matching. Retry passed. The test now targets the accessible heading role for both empty states, which excludes the hidden copy. A focused Chromium check with duplicate hidden/visible headings found exactly **1/1** accessible match; targeted ESLint, web typecheck and diff check passed. The full `52a06411` Chromium run passed **591/591** runnable cases without retries; **63** conditional cases were skipped. | PASS in production CI | `knowledge.spec.ts`; [flaky CI log](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/36410189219), [clean CI](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/36413262514) |

The B01 failure left local Playwright screenshots and traces in `apps/web/test-results/`; they
showed the dialog closing and focus landing on the body. These diagnostics are local, not pushed.
The B03 test initially found the same symptom by another path: the dashboard card was rerendered
during loading, so passing the button element's value at render time passed `null`. Passing the
ref lets the scene read the mounted button when it needs to restore focus. The complete installed
Chrome celebration suite then passed **10/10** on mobile and desktop in **1.0 min**.
The first B02 run used the wrong translated action label in the new test; the visible button said
"Devam edelim". Correcting that fixture made both cases pass. No personal browser profile or
real external provider was used. The CI bundle result is the release gate; development-server
page sizes are not substituted for production output. Against the pre-fix CI artifact, dashboard
total fell **32,418 B** and now has **32,292 B** of headroom. Article total rose **7,137 B** but
remains **21,071 B** below its gate. The complete CI test and browser steps were still running
when these budget values were recorded; their result is tracked separately from P07. The replay
focus ref added **44 B** to the first passing bundle snapshot and stayed within the final PR gate.

The coach next/back test previously required React view-transition types after a prefetch-dependent
route change. An uncached click can navigate correctly without that animation, which the test's own
comment already accepted. B04 now verifies navigation, immediate interaction and return. Directional
animation types remain outside this smoke assertion. The SSE test opens the settings route directly
and waits for its mocked event connection; an unrelated profile redirect and ongoing network
requests no longer decide the focus result. The API-enabled CI run closed the earlier P08 failure;
the font/export snapshot exposed P12 and needs a browser rerun after the test correction.
P09's unfinished route request is visible in the local Playwright trace; this is development
compilation timing, not evidence that the production build passes the same case.
P10's failure occurred in a build with no font-source code change from the prior successful run,
and another font family had failed in the earlier local attempt. This supports an intermittent
resolver failure rather than a deterministic bad import. The local Fontsource smoke covers the
board's variable and fixed faces. Five clean CI builds with local fonts passed, and the
browser rerun after P12's test correction passed. PNG export uses the
same font family values as the editor; pixel-for-pixel visual parity has not been asserted.

The `3157d6dd` full browser run exposed P12, while its build, budget and unit-test steps passed.
The first local repeat against a cold Next development server timed out on both mobile runs
after the typed PUT was sent near the overall test deadline; both desktop runs passed. The warm
rerun with a 60 s local timeout passed 4/4 in 26.9 s. This development compile timing is
separate from the CI production failure, which was the test reading its first draft save.
Sending an empty in-progress note to the API is a low-priority follow-up: the real validation
rejects it, and a later edit or blur triggers another save. The mocked API accepted it for this
test. The transient request does not demonstrate data loss, but it is unnecessary traffic.
At `6d8b64c6`, the complete Linux CI job passed: audit, secret scan, lint, typecheck, build,
production budgets, unit tests and seeded API setup; Chromium had **590 passed, 1 flaky and 63
skipped**. The report-only `a7f0cb27` run then passed **591**, with **63 conditional skips** and
no flaky case. At `570f509f`, the coach-test improvement passed a fresh production CI run with
**591 passed, 63 skipped and no flaky browser case**. The following report-only commit exposed P14:
**590 passed, 1 failed and 63 skipped**. P14's targeted local rerun and the `c8066e8d` production
CI passed; the latter had **591 passed, 63 skipped and no flaky browser case**. Deployment edge
controls and the Firefox/real-Safari release matrix remain open in the linked release-gate report.
The `ec555b39` report-only run was green with **590 passed, 1 flaky and 63 skipped**; P15 records
the strict-locator failure. The `52a06411` fix passed the full Chromium suite with **591 passed,
63 skipped and no flaky case**. Deployment edge controls and the Firefox/real-Safari release
matrix remain separate open gates.
