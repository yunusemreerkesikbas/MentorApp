# Mentor QA — 24 September 2026 — Stage 4 community, mentorship and admin

## Scope and environment

This wave used the uncommitted `feature/APP-110` working tree at
`0915d92cb7e04fe721fe8e26eba2f531519f1b72`. The [start snapshot](evidence/2026-09-24-stage4-snapshot.json)
records the shared tree before QA edits; the [final manifest](evidence/2026-09-24-stage4-final-snapshot.json)
records the tested QA files and
screenshots. Concurrent W8 coach changes were already in progress. The API was rebuilt after those
edits for the browser run. The isolated database was `mentor_test` on local Postgres port 5433;
AI, vision, storage, payment and email used fake providers. Browser tests used installed Chrome,
fresh Playwright contexts, and disposable `example.test` accounts. They never used a personal
Chrome profile. The real-API run used web `localhost:3000`, API `localhost:3001/v1`, and admin
`localhost:3203`. Only the isolated test database temporarily enabled mentorship sponsorship;
the fixture restored its original value afterward. Live provider and deployment claims are out of
scope for a local pass.

`PASS` below means observed in this environment. API durations are shared suite durations because
the runner did not produce stable individual scenario times. Screenshots are captures of the final
successful browser run; failed attempts are described under diagnostics.

## Scenario results

| ID | Expected | Actual result and evidence | Status | Duration |
| --- | --- | --- | --- | --- |
| C01 Community discovery | A student sees the forum hub in TR and EN on mobile and desktop; feature gates prevent direct disabled access. | Forum API E2E covered cold start, feed, search, pagination, moderation, poll, attachments, reactions, saved items and notification paths. Real API Chrome loaded the localized featured post on both viewports. [API](../../apps/api/test/forum.e2e-spec.ts), [browser](../../apps/web/e2e/qa-stage4-real-api.spec.ts), [mobile](evidence/2026-09-24-stage4-community-mobile-chromium.png), [desktop](evidence/2026-09-24-stage4-community-desktop-chromium.png). | PASS locally | Forum in shared W7 run; Chrome 2.7 min shared across six cases. |
| C02 Effort board | Personal XP remains available while the leaderboard flag is off; ranking uses XP only when explicitly enabled. | The initial existing fixture assumed the launch-off leaderboard was on (39/41 in combined W7). It now tests the off state, explicitly enables ranking scenarios, and restores flags. Community E2E passed 6/6; forum E2E had passed 36/36 in the first run. [Regression](../../apps/api/test/community.e2e-spec.ts). | PASS after fixture correction | Community 27.65 s; forum shared W7 run. |
| M01 Consent and private data | An invite preview does not link a student. Explicit acceptance fills only the chosen coach's roster; another account and an unlinked coach get no private data; ending the link revokes access. Raw AI chat text stays private. | Real API Chrome verified TR/EN consent, acceptance, coach roster, unrelated-account 404, and post-revocation 404 on both viewports. A synthetic distress-message marker appeared in neither the coach report nor roster JSON. Mentorship API E2E also covers PII and free-text exclusion, code rotation, role gates and revoked consent. [Browser](../../apps/web/e2e/qa-stage4-real-api.spec.ts), [mobile consent](evidence/2026-09-24-stage4-consent-mobile-chromium.png), [desktop consent](evidence/2026-09-24-stage4-consent-desktop-chromium.png), [mobile roster](evidence/2026-09-24-stage4-roster-mobile-chromium.png), [desktop roster](evidence/2026-09-24-stage4-roster-desktop-chromium.png). | PASS locally | W8 API 79.09 s shared; Chrome 2.7 min shared. |
| M02 Seat, application and coach work | Unverified or inactive coaches cannot issue invitations; seat bounds and sponsorship gates hold; plans, follow-ups, briefs and cohort evidence stay link-scoped. | Six W8 API E2E files passed 115/115, including verified-email admission, admin suspension/reinstatement, seat limits, coach plan notes, weekly brief access and Istanbul-day evidence. [Mentorship](../../apps/api/test/mentorship.e2e-spec.ts), [seats](../../apps/api/test/mentorship-seats.e2e-spec.ts), [applications](../../apps/api/test/mentorship-applications.e2e-spec.ts), [follow-ups](../../apps/api/test/mentorship-followups.e2e-spec.ts), [weekly brief](../../apps/api/test/mentorship-weekly-brief.e2e-spec.ts), [cohort evidence](../../apps/api/test/cohort-evidence.e2e-spec.ts). | PASS locally | 79.09 s shared. |
| A01 Admin session and roles | A student cannot read settings; admin login uses its separate session; settings are visible only to the authorized role, with no localStorage token. | API returned 403 for the student. Real Chrome logged into admin on both viewports, opened settings, found the HTTP-only admin refresh cookie and no localStorage admin token. The login page's visible labels lacked input association; matching `htmlFor`/`id` fixed this and the browser regression passed. [Browser](../../apps/web/e2e/qa-stage4-real-api.spec.ts), [login](../../apps/admin/src/app/login/page.tsx), [mobile](evidence/2026-09-24-stage4-admin-mobile-chromium.png), [desktop](evidence/2026-09-24-stage4-admin-desktop-chromium.png). | PASS after accessibility fix | Admin API 81.29 s shared; Chrome 2.7 min shared. |
| A02 Admin operations | RBAC, audit and validation protect user changes, config, content, calendar, metrics, economy and refunds. | Seven W6 API E2E files passed 55/55. They include SUPPORT/FINANCE/SUPER_ADMIN separation, student/anonymous denial, audited status and role changes, KVKK anonymization, trusted editorial metadata, calendar rules and capped refunds. [Admin](../../apps/api/test/admin.e2e-spec.ts), [RBAC](../../apps/api/test/admin-rbac.e2e-spec.ts), [content](../../apps/api/test/admin-content.e2e-spec.ts), [calendar](../../apps/api/test/admin-exam-calendar.e2e-spec.ts), [subscription](../../apps/api/test/admin-subscription.e2e-spec.ts). | PASS locally | 81.29 s shared. |

### Run totals and diagnostics

- API: **42/42 W7**, **115/115 W8**, and **55/55 W6** after the C02 fixture correction.
- Installed Chrome with real API: **6/6 passed in 2.7 min**, mobile and desktop, one worker.
- Installed Chrome with mocked API responses: **100 passed, 4 conditionally skipped** across the
  community hub, mentorship and coach-home UI suites. The main 104-case run had 98 passes, 2
  community failures and 4 skips in 8.2 min; the two community cases passed in a separate 33.2 s
  rerun after fixture repair. The four skips are intentional viewport-only coach navigation cases.
  [Community UI](../../apps/web/e2e/community-hub.spec.ts),
  [mentorship UI](../../apps/web/e2e/mentorship.spec.ts),
  [coach-home UI](../../apps/web/e2e/coach-home.spec.ts).
- The API production build, admin TypeScript check, and changed-file ESLint checks passed.
  Mocked UI results prove presentation behavior against declared fixtures, not server authorization.

The first Chrome attempt used a newly registered student without an exam profile; the app correctly
sent that account through onboarding. The fixture now completes the profile. Repeated local logins
then hit the intended auth rate limit; the fixture reuses issued HTTP-only refresh cookies and
respects the throttle window. The first six-test rerun was interrupted when the shared web dev
server exited; API, admin and database remained healthy. Restarting the local web server resolved
that environment issue. A later desktop coach assertion was covered by the coach account's initial
journey-level celebration, visible in the failure screenshot and trace. The fixture now acknowledges
that event before opening the roster. None of these interrupted attempts was counted as a product
pass. The admin label issue was a product accessibility defect and was fixed before final green.
The mocked community hub initially used a hardcoded `localhost:3100` CORS origin while the active
web was on port 3000, so it fell back to login. Once the mock responded for the active origin,
the page rendered and exposed an outdated copy assertion. The fixture now uses the current
localized empty-tags message. The final targeted rerun passed on both viewports.

## Decision and release gate

No open local P0/P1 was found in the covered Stage 4 paths after the admin label fix. The local
stage passes the API and real-browser gate. Production-like Cloudflare/Render/R2 policy, live
provider behavior, MFA/origin protection and Chrome/Firefox/real Safari remain a separate staging
release gate. Full CI was not run in this iterative wave; it remains mandatory before merge/release.
