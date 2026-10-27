# Community discovery advertising preparation

> **For agentic workers:** Use superpowers:executing-plans inline. Preserve concurrent work and finish with one independent read-only review.

**Goal:** Prepare one default-off Google slot on the existing discovery home without changing its content.
**Architecture:** Reuse Ads/GPT/config. A Forum application service assembles a public-only page proof; no new table/provider/page. A separate audited `review_approved` gate records the operational Google/content/crawling/privacy review, not automatic Google certification or per-post editorial approval.
**Tech stack:** Existing NestJS, Zod, TypeScript, Next.js, Vitest and Playwright.
**Spec:** User-approved existing-page preparation, pending inventory review. One desktop rail-end slot becomes the final mobile element, 250x250/300x250, no refresh/sticky behavior.

## Constraints and review focus

- Both enable/review flags default false; empty Google path disables delivery. Neither production nor local sample mode bypasses the context/review gate.
- Keep all existing hub cards. Any continuation/history rows, buddy active/pending state, private/archived sidebar/content room or failed context lookup denies ads. This intentionally restricts coverage.
- Hash exactly the existing public hub/selected waiting rail/sidebar content; return the selected waiting list with its proof. Policy must re-read and match the rendered proof. Ignore volatile counts/presence and private action flags.
- Require a nonempty featured discussion and an answered/readable public context; technical checks do not establish Google's inventory-value approval.
- Buddy UI independently confirms it has no personal card before mounting the ad. Unsafe/error state permanently suppresses advertising for the visit, before private content renders.
- Editing/search/dialog/room changes cancel pending and filled ads. No live moderation push or polling is added. Current subscription teardown remains.
- No sponsor system, free-feature gates, tracking table, content redesign or unrelated cleanup. Shared changes append only; no automatic commit of a dirty workspace.

## Tasks

- [x] Add failing Forum/Ads tests for gated extra reads, matching proof and conservative privacy/error handling; implement shared placement/config/proof contracts, Forum service and existing endpoint wiring.
- [x] Integrate one existing deferred slot at rail end, shared interaction teardown, exact waiting snapshot and buddy safety callbacks; keep legacy behavior when gates are off.
- [x] Run scoped contract/app type checks, regression units and synthetic desktop/mobile browser tests (private/closed/error/no-fill/narrow/single request/interaction/entitlement).
- [x] Independent review, docs/API/roadmap timeline and final evidence. Full CI remains a merge gate; no production activation.

## Execution ledger

Ruling: Conservative privacy exclusions preserve the existing screen rather than removing personal cards to make ad inventory. Most established users may remain ineligible; revisit only after product/privacy review.
Ruling: Reuse the existing placement query's contentRevision without a fake question ID; give hub context its own explicit component prop and service argument.

Ruling: Persistent sidebars can hold old private room titles after membership changes elsewhere.
Both rendered sidebar snapshots now must match the proof's sidebar rooms before mounting the slot.
Incomplete/failed sidebar reads remain unknown. This preserves cards and adds no polling.

Ruling: The existing development React lifecycle can retry a cancelled eligibility HTTP request.
The browser assertion follows the existing question suite: one placement identity, one GPT script
request and one Google display. It does not conflate policy reads with billable impressions.

## Verification evidence

- Red: focused Forum test failed because the new service did not exist, before implementation.
- Green: 124 scoped API/Forum/Ads unit tests passed; nine real-Postgres API tests passed, including
  session requirements, public rejection, malformed revision validation and both disabled defaults.
- Browser: 64 synthetic desktop/mobile scenarios verified (30 discovery, 34 existing question).
  The combined run passed 62 and exposed two overly strict policy-read assertions; the corrected
  two placement cases passed on a targeted rerun with one script/display asserted. Privacy soft
  navigation and pending callback cancellation passed on both devices. Desktop/mobile screenshots
  were inspected. Fixtures use no real Google traffic or student data and prove no revenue.
- Shared types/validation compiled. API/web/admin type checks and targeted lint passed; whitespace
  checks passed. Full workspace CI was not run and remains mandatory before merge/release.
- Fresh read-only review found the stale-sidebar issue; the fix and navigation regression were
  re-reviewed with no remaining actionable finding. No database migration, config override write,
  production activation, commit, merge or push was performed in this step.
