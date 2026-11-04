# Weekly deep analysis verification

Date: 2026-11-04. Scope: [approved design](../plans/2026-11-04-weekly-deep-analysis-design.md)
and [implementation plan](../plans/2026-11-04-weekly-deep-analysis-plan.md).

## Decisions and execution record

- Used the existing non-main feature checkout and preserved concurrent changes. During execution,
  another actor committed the in-progress feature with other workspace changes as `84ed8f22`.
  Review therefore used the scoped file list and baseline `417e5721`, not only uncommitted diff.
- Detailed facts are deterministic and saved with the report; the existing AI note is reused.
  No additional model call, report price, allowance, migration or acquisition endpoint was added.
- Archived snapshots without detail show their saved summary and an explicit limitation. They
  are never rebuilt from mutable current evidence.
- Tests use installed local executables because the pnpm launcher attempted a blocked registry
  lookup. Browser runs use installed Chrome and the existing local development server.
- Initial archived-read test expected one GET; development Strict Mode can replay a read-only
  effect. The final test allows that initial replay and proves view switches add no GET or POST.
- Browser output was isolated to this feature to avoid collisions with concurrent suites.

## Verification

- Baseline weekly policy/review/settlement unit suites: 15 passed before implementation.
- New calculator test initially failed because the implementation was absent, then passed.
- Backend focused suites: **72 passed** across deep-analysis calculation, weekly review,
  narration, Coin access and locking. Covers negative nets, missing baselines, real zero values,
  study-only subjects, per-week samples and exclusion of private task titles/custom labels.
- Web recap/policy unit suites: **29 passed**.
- HTTP/Postgres owned-report suite: **18 passed** on local `mentor_test`. Includes a frozen
  deep-analysis assertion plus one-debit replay, concurrent last-slot claims, stale quotes,
  provider/budget failures, paid-right preservation, subscription expiry and owner isolation.
  The first attempt lacked `TEST_DATABASE_URL`; the rerun supplied the documented local test URL.
- API and web TypeScript checks, shared types build, and initial touched-file lint checks passed.
- OpenAPI export and Orval generation completed; response metadata documents optional saved detail.
- Initial new mobile/desktop journeys: **14 passed**. Final expanded browser regression:
  **22 passed**, including existing recap access, both report views for earned/Coin/Premium,
  archived reports, incomplete weeks, Free discovery, English chrome and previous-only samples.
- Post-review web typecheck, touched API/web lint and generated API-client build passed.
- Final focused total: **141 tests passed** (72 backend unit + 29 web unit + 18 HTTP/Postgres
  + 22 browser). This is not a full-workspace CI claim.

## Independent review

Fresh read-only review found no introduced access, privacy, payment or snapshot-preservation
defect. One P2 finding identified a previous-only subject average without its sample count.
The dedicated browser test failed on the missing `7 deneme` label before the fix. Both weeks now
display their backend-provided attempt counts explicitly. Mobile screenshot inspection also
moved the story switch into the header card to avoid the app's mascot decoration.

## Limits

No real-provider AI call, production configuration change, deployment or full workspace CI was
performed. Generated text quality is unchanged because the existing narration prompt is reused.

## Follow-up browser scenarios and screenshots

Final-slide action follow-up: the regression first failed because the analysis action was present
on the welcome slide. After moving it into the closing action group, **8 browser cases passed**
(earned, Coin, Premium and historical reports at mobile/desktop widths). Each checks absence on
earlier slides, presence on the final slide and unchanged acquisition/model-request counts.
Touched story/test lint passed. No broad workspace pipeline was needed for this scoped UI move.

At the user's request, reran real Chrome with controlled API responses at 375×812 and 1280×800.
Final run: **27 passed, 1 not applicable** (desktop sidebar geometry is skipped on mobile).
Screenshots were saved for Free discovery, earned first report, Coin confirmation (500 → 250),
Premium inclusion, deep detail, visual recap, historical snapshots, incomplete weeks, insufficient
Coin and exhausted allowance, plus English study-only content.

- Expanded the detail example to three study metrics and three subject states: Mathematics
  10 → 12 net, Turkish 20 → 18 net, and History study activity without an exam baseline.
- Acquisition tests assert exactly one open request and no additional generation/acquisition
  while switching views. These are browser contract tests, not real wallet debits.
- Aligned the example teaser's 265 minutes with its saved report, without changing shared fixture
  expectations used by existing recap tests.
- A screenshot taken during a transition initially looked overlapped by the sidebar. Direct
  geometry confirmed the settled title at x=309 and sidebar edge at x=240. Screenshot capture now
  waits for that invariant and disables capture-time animations; production code was unchanged.
- New insufficient-balance and exhausted-window cases prove there is no purchase request and no
  Coin opening button. Existing recap entry, sample-count and archived-read cases still pass.
- Touched browser-test lint passed. Screenshots are local artifacts under the current chat's
  visualization directory, named `weekly-qa-{gift,coin,premium,detail,recap,limit}.png`.
