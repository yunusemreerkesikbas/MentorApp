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

The first Chrome run had **19 passes, 4 navigation timeouts and 1 skip**. Each timeout occurred
while `page.goto` waited for the cold development server's `load` event, before a product
assertion. The four affected cases passed **4/4** on a warm two-worker rerun; the full warm scope
then passed as C07. Initial and rerun logs are in the run index. No visual defect remained that
required a screenshot. The initially written C05 fixture expected 201 from the invite-code route;
the route correctly returned 200. The expectation was corrected before the passing run.

## Open gates and next check

There is no current production-build manifest for this W8 overlay. The Next development server
is using the checkout's `.next` directory, so this run did not replace it with a concurrent build.
The 704/985 KiB article, 760/1295 KiB panel and font budgets therefore remain
**unverified on this source**. Message scopes passed separately in P01. The prior candidate's panel total had only 1.2 KiB headroom; see
the linked release-gate report. A production build and budget check are the next local gate once
the development server is free or an isolated build checkout contains the same overlay.

C05 proves sequential daily enforcement. Simultaneous coach AI requests and a real-API Chrome
flow for this new AI surface remain untested. Full CI, deployed Cloudflare/Render/R2 controls,
Firefox and real Safari also remain release gates. No new product P0/P1 defect was established
in this targeted run, but these open gates prevent declaring the full test plan complete.
