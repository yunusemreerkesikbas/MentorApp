# Existing display inventory launch preparation

> Execute inline with superpowers:executing-plans; finish with one independent read-only review.

**Approved scope:** Prepare existing ad placements for launch. Do not create a room/page/placement,
activate production flags, claim Google approval or send real ad traffic. Publisher account/site
approval/domain/ID are external inputs; ask while finishing independent code work.

**Architecture:** A read-only SUPER_ADMIN Ads report reads the central registry once and existing
server environment. Embed it in the existing config screen, with no new navigation page. Reuse
unit-source resolution between runtime and report. Report configuration blockers and explicit
manual checks; an empty blocker list never means Google approval or user eligibility.

## Tasks

- [x] Test and implement unit resolution and production rejection of official sample inventory;
  validate legacy environment units with the existing shared Google path schema. Preserve local
  official sample behavior and all entitlement/country/content protections.
- [x] Add shared read-only readiness contract and `GET /v1/admin/ads/readiness` under the same
  SUPER_ADMIN boundary as central settings. Include all eight DISPLAY placements, switches, unit
  source/status (no raw unit/env secrets), country allowlist, local sample status and safe configured
  site origin. No content/user reads, external calls, database writes, new tables or polling.
- [x] Embed a compact summary/refresh/errors/manual prerequisites in existing admin `/config`.
  Refresh after successful config edits; preserve all existing audited mutation flows. Show pending
  content/Google/privacy/crawling/ads.txt checks explicitly, without inferred approvals.
- [x] Update shared public/settings TR/EN advertising disclosure to cover gated current inventory
  and ad-free editors/coaching/study flows, preserving independent analytics choice and limited-ad
  processing disclosure. Update environment guide and rollout/rollback runbook.
- [x] Run scoped unit/API/browser/contract/type/lint checks, independent review, feature/API/
  integration/roadmap timeline. Export OpenAPI/client if changed. Production remains off; full CI
  and provider/site/privacy approval remain required before release.

## Review focus

- Official sample units must be blocked in production even when pasted into config/env with the
  local test flag off. A sample is not revenue inventory.
- Report only the current process/deployment. Do not pretend the API can verify the separately
  deployed web ads.txt, Google account/site approval, CMP/legal review or content approval freshness.
- Empty blog config preserves its legacy env fallback; empty other units disable delivery.
- Missing/error reports must not show stale positive configuration or mutate switches.
- Current rollout/country/exam/entitlement/manual review guards remain unchanged.

## Verification and external status

- API ads/env unit suites: 194 passed; fresh isolated local Postgres API suite: 14 passed,
  including readiness 401/403/SUPER_ADMIN permissions and zero configuration writes.
- Web ads.txt/i18n unit suites: 8 passed. Chromium mobile/desktop readiness/disclosure checks:
  10 passed, including failed refresh, retry and successful existing config save.
- API/admin/web targeted typechecks and shared types/validation/API-client compilation passed.
  OpenAPI export and client generation completed. Scoped lint passed with two existing admin
  config effect warnings; no new lint errors. Diff whitespace check passed.
- Independent read-only review found no actionable P1/P2 issue. Its staging-sample documentation
  caveat was corrected: a production-built staging process rejects official DISPLAY samples too.
- First browser run passed 8/10. Both failures were the test's immediate checkbox assertion:
  the captured page already showed successful save and refreshed settings. Test now clicks the
  controlled input and waits for the async response and final checked state; all 10 pass.
- The user chose to inspect the existing Google account, then explicitly selected that account
  for signup. Google reported no AdSense account. Signup is blocked by repeated reCAPTCHA
  connectivity failure/disabled agreement field; no account or accepted terms were created.
  Browser signup draft is left open for the owner. No remote config, production switches or
  live ad traffic were changed. Full CI and external Google/site/privacy approval remain pending.
