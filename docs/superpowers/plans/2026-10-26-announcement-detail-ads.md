# Reviewed announcement detail advertising

> Execute inline with superpowers:executing-plans and one independent read-only review at the end.

**Goal:** One default-off ad after the visible comments on the existing public-room announcement detail. No new page, feed/chat/profile inventory, provider or sponsor system.
**Architecture:** Forum builds a publisher snapshot through its application service. Ads verifies rendered/current/editor-approved revisions. Reuse the existing Ads approval table with an additive content-type discriminator; question and announcement approvals/revokes remain isolated. No additional table.
**Approved scope:** User selected reviewed public announcement details, preserving content and disabling advertising when composition/files/dialogs begin. Technical readiness does not activate real inventory or certify Google approval.

## Tasks

- [x] Write failing snapshot/service tests. Add shared announcement contracts, UUID/revision validation, separate default-off flag/unit and scoped approval storage; generate a forward-only migration after the schema is final.
- [x] Add Forum announcement page proof: only PUBLIC, active ANNOUNCEMENT rooms, nonempty text, known exam context, supported reviewed images and all visible top-level comments. Include public identity/avatar/tags/edit timestamps, exact room rail and expected sidebar. Reject private/CHAT/QA/poll/coach/unsupported media/incomplete lookups. Hidden nested replies are not reviewed/rendered with an ad; interaction removes the ad before expansion.
- [x] Add EDITOR/full-admin preview/approve/revoke in the existing admin Forum screen. Stale approval is 409, audit stores metadata only, revocation remains available after content disappears. Account erasure uses the existing reviewer cleanup.
- [x] Integrate the existing message detail: extract existing state/actions into a hook for file size, return proof with existing detail endpoint only while the flag is on, use the server room, match persistent sidebar snapshots, append one lazy slot after comments. Any main interaction (including composer/file buttons, nested replies, edit/reaction lists) permanently suppresses it. Clear proof after local content changes.
- [x] Verify scoped unit/API/Postgres/browser checks (default-off/anonymous/type isolation/audience/regions/private/stale/320px/no-fill/one Google display/composition/files/dialogs/edits/subscription); read-only review, feature/API/integration/roadmap updates. Full CI remains a merge gate.

## Constraints and rulings

- Preserve existing user changes and prior ad work; no automatic commit/merge/push of this shared dirty checkout.
- Google unit paths only, validated/audited through existing config; empty disables delivery, no env fallback. Local official sample mode still requires an enabled page proof and approval.
- No live moderation push or ad refresh. Production stays off pending inventory/content/crawling/privacy/disclosure review. Never supply real student accounts or private data to Google.
- Visible top-level comments participate in approval. Nested reply counts participate; opening hidden replies ends advertising before that content appears. No hidden reply content is sent to Google or stored in the ad audit.
- Existing table names retain their legacy question terminology to avoid a disruptive rename; `content_type` is the explicit isolation boundary.

## Verification and review ledger

- Red: the snapshot suite failed before the implementation existed; 30 new focused snapshot/page/
  review/policy tests then passed. The final scoped API/Forum/Ads/config regression run passed
  184 tests. Shared types and validation compile; API/web/admin type checks passed.
  Targeted lint has zero errors; the unchanged admin Forum loading effect retains its existing
  `react-hooks/set-state-in-effect` warning. No unrelated loading-flow rewrite was introduced.
  OpenAPI was exported and the Orval client regenerated, including related community review
  routes from the same work. The generated client compiles; only trailing whitespace in its
  newly generated additions was normalized.
- Real Postgres: all 13 API tests passed in a disposable local database with the full migration
  chain, including stale content, type isolation in both revoke directions, metadata-only audit,
  hidden content revoke and reviewer erasure for both QUESTION and ANNOUNCEMENT. An initial run
  against the shared test database correctly failed closed because its 4,623 visible rooms exceed
  the complete-sidebar limit. No fixtures belonging to others were deleted. Disposable databases
  created for the isolated runs were removed after the app/test exited.
- Browser: all 32 announcement desktop/mobile cases passed, plus 14 targeted existing question/
  discovery regressions. One script/display, width filtering, no-fill/errors, CHAT/private/stale
  sidebar rejection, composition/files, reply dialog/comment navigation, pending callbacks and
  subscription teardown were checked. Screenshots were inspected. Fixtures used synthetic API/GPT,
  no real Google traffic, student data or revenue evidence.
- Independent review found a local admin media-origin issue. Both review panels now use the
  shared pure URL resolver; CSP permits the configured API origin without a blanket HTTP source.
  Five focused media/CSP tests passed (the CSP regression failed before the fix), and read-only
  re-review found no remaining actionable issue.
- Design-hook classification: the `<img` text in the snapshot validator is a regex rejecting
  unsupported inline media, not a rendered image. The broken-image hint there is a false positive;
  no ignore configuration or source suppression comment was added.
- Migration `0131` was generated after the schema was final and applied to the verified localhost
  `mentor` database only after confirming it was the sole pending migration. No flags were changed.
  Production activation/migration and full workspace CI remain deployment/merge steps; no commit,
  push or merge was performed on the shared dirty checkout.
