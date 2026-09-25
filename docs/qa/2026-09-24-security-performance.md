# Mentor QA — 24 September 2026 — Stage 1 security and performance

## Scope and environment

- **Snapshot:** isolated QA worktree based on `220cd24ef16b431d310d5199b36129659fb10be9` (APP-108), overlaid with the uncommitted working-tree changes present when testing began. The source checkout advanced to `307de33cb988c4126ebc08b2a9ef958ebc425efe` (APP-109) during the run. The [hash manifest](evidence/2026-09-24-snapshot.json) records the QA overlay. Results apply to that snapshot, not to later edits.
- **Environment:** Windows, local Nest API `localhost:3101`, production Next web `localhost:3100`, production Next admin `localhost:3102`, Docker Postgres `mentor_test` on port 5433. AI, vision, storage, payment and email providers were fake. Browser sessions used disposable accounts and isolated Playwright contexts. No personal Chrome profile data was used.
- **Browser:** installed Chrome for the final desktop **and mobile viewport** real-API smoke runs; Chromium for the 80-load baseline. The interactive Chrome tab was also used for an initial login, then the browser connector disconnected. Automated browser evidence is the complete repeatable check.
- **Status terms:** `PASS` means the expected result was observed in the stated environment; `BLOCKED` means the necessary deployed control was unavailable; `FINDING` is a measured issue without a stage-one hard threshold. API responses mocked by a browser test are identified separately.

## Security scenarios

API timing below is the **shared 140.4 s targeted suite run**, not a fabricated duration for each assertion. The browser durations are Playwright per-test durations from installed Chrome desktop, with the same six tests also passing in Chrome's mobile viewport. The targeted API suite includes `auth`, `auth-rate-limit`, `admin-rbac`, `rls-isolation`, `payments`, `notifications`, `ai-coach`, and `errors` E2E files.

| ID | Expected | Actual and evidence | Status | Duration |
| --- | --- | --- | --- | --- |
| S01 | Web/admin cookies and refresh sessions remain independent; no durable token storage. | Web: two tabs refreshed and both lost access after logout; `mentor_web_refresh` was HttpOnly and scoped to `/v1/auth`. Admin: real login, reload and logout worked; `mentor_admin_refresh` was HttpOnly at `/v1/auth/admin`, with no web cookie or stored admin token. [Browser test](../../apps/web/e2e/qa-critical-real-api.spec.ts), [admin screenshot](evidence/2026-09-24-admin-chrome.png). | PASS | Chrome 5.8 s web + 2.7 s admin desktop; 4.5 s + 2.4 s mobile. |
| S02 | Concurrent refresh, old-cookie replay, logout and password reset invalidate unusable sessions. | Targeted identity API E2E passed; browser two-tab refresh/logout passed. A premature test reload initially aborted a refresh response and triggered the intended fail-closed rotation; the test now waits for both tabs to finish bootstrap. [Identity tests](../../apps/api/test/auth.e2e-spec.ts), [browser test](../../apps/web/e2e/qa-critical-real-api.spec.ts). | PASS | Shared API suite; browser 5.8 s. |
| S03 | Suspension, role removal and admin subroles deny old authority. | Admin RBAC and identity E2E denied disallowed actions, including stale authority. Forged Cloudflare assertion did not authorize a student. [RBAC tests](../../apps/api/test/admin-rbac.e2e-spec.ts), [browser test](../../apps/web/e2e/qa-critical-real-api.spec.ts). | PASS locally | Shared API suite; forged assertion 0.45 s browser. |
| S04 | Separate student data under restricted DB role; coach cannot receive raw AI confessions. | RLS isolation and mentorship/account erasure E2E passed in the isolated DB; cross-user notebook entry returned 404 in the real-API browser test. [RLS suite](../../apps/api/test/rls-isolation.e2e-spec.ts), [media test](../../apps/web/e2e/qa-critical-real-api.spec.ts). | PASS locally | Shared API suite; media browser 0.90 s desktop. |
| S05 | Admin CSP and Access assertion checks; deployed MFA and origin isolation. | Admin response had `strict-dynamic`, `object-src 'none'`, `frame-ancestors 'none'`, no `unsafe-eval`; forged assertion received 401/403. Cloudflare Access MFA and direct-origin bypass cannot be assessed on localhost. [Browser assertion](../../apps/web/e2e/qa-critical-real-api.spec.ts). | BLOCKED for staging controls; local checks PASS | Chrome 0.45 s. |
| S06 | Single-use upload, MIME/size policy, private media ownership and signed URL lifetime. | MIME `text/html` rejected, PNG upload succeeded, ticket replay returned 401, another student's entry returned 404, signed image loaded in Chrome, altered expiry returned 404, `private, no-store` sent. A clock-controlled [unit case](../../apps/api/src/shared/adapters/storage/fake-storage.adapter.spec.ts) proved that an unchanged valid signature stops working after 60 seconds; existing storage tests cover size/content signatures. | PASS locally | Chrome 0.90 s desktop; 0.65 s mobile; unit run 1.02 s. |
| S07 | Push target, SSE token, Turnstile and throttling reject misuse. | Focused storage/push/Turnstile unit suites and notification E2E passed. Separate signup throttle test confirmed the sixth invalid request returns 429 after five 400 responses. [Rate-limit test](../../apps/api/test/auth-rate-limit.e2e-spec.ts), [notification E2E](../../apps/api/test/notifications.e2e-spec.ts). | PASS locally | Shared API suite; focused unit run not individually timed. |
| S08 | AI budget/Free gates, webhook idempotency and safe errors/logs. | AI coach, payment and error E2E passed with fake providers. AI unit tests covered reservation and Free entitlement. A visible `<<PERSONALIZATION:NONE>>` stream marker was found, removed in [chat service](../../apps/api/src/modules/ai/application/chat.service.ts), and the targeted AI tests passed again. No paid or live AI call was made. | PASS locally after fix | Shared API suite; focused AI unit/E2E run not individually timed. |

### Targeted test execution

- API identity + rate-limit: **27/27 passed** after separating the intentional signup-throttle assertion from the auth lifecycle fixture.
- Combined targeted API security E2E rerun: **112/112 passed across 8 files in 140.4 s** (Vitest execution 131.59 s).
- AI coach/marker tests: **65/65 passed** after the fixture reached the actual entitlement gate and the stream marker was filtered.
- Mentorship, account erasure, notification stream: **85/85 passed**. Focused security unit group: **84/84 passed**. Admin unit: **5/5 passed**.
- API targeted typecheck and lint: passed. API and admin production builds: passed. Final installed-Chrome real-API/resilience smoke: **6/6 desktop in 15.3 s; 6/6 mobile in 13.4 s**.
- The panel resilience test uses **one contract-shaped mocked 503 response**, a 1.5 s delay, and then the real API for retry. Its first draft omitted the required `message` field and left the mock response malformed; this was a test-data error, corrected before the passing run. [Panel test](../../apps/web/e2e/qa-panel-resilience.spec.ts), [loading screenshot](evidence/2026-09-24-panel-loading-chrome.png).

## Production build budgets

The Next production manifest was present; the budget script returned zero violations. Byte values are from [the copied generated budget report](evidence/2026-09-24-web-performance-budget-report.json) in the QA worktree.

| Gate | Measured | Limit | Result |
| --- | ---: | ---: | --- |
| Article attributable JS | 417.5 KiB | 704 KiB | PASS |
| Article total JS | 956.7 KiB | 985 KiB | PASS |
| Panel attributable JS | 752.2 KiB | 760 KiB | PASS, 7.8 KiB headroom |
| Panel total JS | 1291.4 KiB | 1295 KiB | PASS, 3.6 KiB headroom |
| Article font preloads | 2 | 2 | PASS |
| Root/welcome/article messages | 248 / 814 / 4107 B | 1024 / 2048 / 6144 B | PASS |

The route bundles were reduced with deferred article ads, a server-rendered share row, a deferred cloud overlay, and modal-only panel/promotion modules. Cookie text was scoped so the root loads only its short banner copy. Relevant implementation is in `apps/web/src/app/[locale]/knowledge/[slug]/_components`, `apps/web/src/lib/cloud-transition.tsx`, `apps/web/src/i18n/route-message-scopes.json`, and the panel components. Web production build, budget check and targeted i18n tests passed. The final cookie-detail wording was corrected after the budget build; it does not enter the three gated message scopes, but a fresh release build remains required.

## Browser performance baseline

The [valid raw baseline](evidence/2026-09-24-browser-performance.json) contains **80 loads**: five cold plus five warm for each of four routes and two viewports. Cold disables browser cache; warm reloads with cache. `wallMs` contains an intentional 1000 ms post-load observation wait, so use `loadMs` and LCP for page comparisons. Values below are medians rounded to milliseconds; transferred bytes are bytes of encoded network responses. Local results have no new hard time threshold.

| Viewport / route | Cold LCP | Warm LCP | Cold load | Warm load | Cold transfer | Warm transfer | CLS cold / warm |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mobile welcome | 1056 | 1040 | 81 | 56 | 2,009,053 | 42,931 | 0 / 0 |
| Mobile article | 284 | 432 | 153 | 178 | 475,040 | 32,349 | 0 / 0 |
| Mobile panel | 652 | 500 | 104 | 65 | 1,038,244 | 225,902 | 0.27 / 0.26 |
| Mobile analysis | 836 | 680 | 145 | 72 | 802,989 | 77,855 | 0.01 / 0.01 |
| Desktop welcome | 630 | 968 | 85 | 61 | 2,009,053 | 13,665 | 0 / 0 |
| Desktop article | 412 | 380 | 142 | 80 | 474,884 | 34,680 | 0 / 0 |
| Desktop panel | 560 | 616 | 75 | 62 | 1,088,830 | 232,717 | 0.09 / 0 |
| Desktop analysis | 524 | 508 | 86 | 57 | 891,396 | 82,684 | 0 / 0 |

Every sample stayed on its intended route and had **zero 429 responses**. Public pages made an expected unauthenticated refresh attempt (401), and disabled optional economy/forum integrations returned 404. The panel requested `/coaching/today` **once per load**. Analysis did not fetch review history before opening its tab. The panel requested `/subscription/offers` **twice per load** on both viewports; this is a P2 efficiency finding. Mobile panel CLS ranged from 0.13 to 0.33 in cold and warm samples, median 0.27/0.26; investigate the shifting element before assigning a stricter gate. The initial [invalid run](evidence/2026-09-24-browser-performance-throttled.json) hit the 30/min refresh limit because 80 loads were driven without pacing; it is retained only as a harness diagnostic, not a product performance result. The script now pauses between batches and rejects redirected/429 samples.

## Decision and next wave

No open P0/P1 defect was found in the local stage-one snapshot after the marker fix. The local security checks and production build budgets pass. **Stage 1 is locally complete, with S05 deployment controls blocked until staging exists.** Full CI, Cloudflare Access MFA/origin protection, Render/R2 behavior, Firefox and real Safari remain release gates and are not inferred from these local results.

Priority for the next review: (1) inspect the mobile panel's layout-shift sources, (2) deduplicate the second automatic offer request without caching stale checkout prices, (3) run the next product wave: identity, content and coaching with TR/EN, Free/Premium and mobile/desktop data. Rebuild and rerun budgets after any production changes. The following wave covers AI/economy/payments/notifications; then community/mentorship/admin.

The first two priorities were completed in the follow-up below; the third is now specified for the next wave.

## Follow-up on 24 September — panel P2 findings

This follow-up uses the dirty `feature/APP-109` checkout at `307de33cb988c4126ebc08b2a9ef958ebc425efe`, copied into the isolated QA worktree. [Source hash manifest](evidence/2026-09-24-panel-followup-snapshot.json) identifies the five changed implementation/test files. The original 80-load baseline above remains the **before** measurement; its values have not been rewritten.

| Finding | Expected | Before | Final actual and evidence | Status |
| --- | --- | --- | --- | --- |
| P2 panel layout shift | Stable hero while entitlement and panel data load; local mobile CLS below 0.1. | Three diagnostic mobile loads measured 0.328, 0.262 and 0.264. The hero grew again when the Free entitlement arrived. [Before shift trace](evidence/2026-09-24-panel-layout-shifts-before.json). | Skeleton reserves the path/CTA/week band space and the real hero waits for entitlement. Final production build with a Free QA student: mobile 0.069, 0.096, 0.096; desktop 0.049, 0.050, 0.049 across three loads each. [Mobile shifts](evidence/2026-09-24-panel-layout-shifts-final-mobile.json), [desktop shifts](evidence/2026-09-24-panel-layout-shifts-final-desktop.json). | PASS locally; Premium and field CLS still need separate review. |
| P2 duplicate offers | One automatic offer request for the panel; checkout pricing remains fresh. | Real API browser baseline and the first red regression test observed two `POST /subscription/offers` requests per load. | `PromotionDialog` consumes the panel's offer response. Installed Chrome mobile/desktop regression tests each observed exactly one request. Coupon/checkout requests were not changed. [Browser test](../../apps/web/e2e/qa-panel-resilience.spec.ts). | PASS locally. |
| Slow/error panel | Skeleton remains until entitlement settles; 503 shows retry, which recovers via the real API. | The delayed-entitlement regression test failed before the gate because the hero rendered early. | Installed Chrome mobile and desktop tests passed, including the injected 1.5 s delay, one contract-shaped 503 and real retry. [Loading screenshot](evidence/2026-09-24-panel-loading-chrome.png). | PASS locally. |

Final Chrome run: **6/6 passed in 58.3 s** across the two viewports. An intermediate run completed 5/6 because six fresh accounts in one minute hit the product's intended signup limit (429) before the sixth scenario began. The fixture now creates one disposable account per browser project and logs in for each test; the next complete run passed. This was a harness issue, not a product failure. Targeted ESLint, TypeScript and production build passed. The final [budget report](evidence/2026-09-24-panel-followup-budget.json) passed: article 417.5/704 KiB attributable and 956.7/985 total, panel 752.9/760 attributable and 1292.1/1295 total, font preloads 2/2, message scopes 248/1024, 814/2048 and 4107/6144 bytes. Panel total JS has only 2.9 KiB remaining headroom, so rerun this gate after further panel edits. Full CI and deployed security controls remain release gates.

The next product wave was executed locally against the isolated test database. Its scope is in
[the Stage 2 scenario matrix](2026-09-24-identity-content-coaching-plan.md) and its results are in
[the Stage 2 report](2026-09-24-identity-content-coaching-results.md). The Stage 1 assertions above remain separate evidence.
