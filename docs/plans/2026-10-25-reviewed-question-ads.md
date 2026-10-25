# Reviewed public question advertising

Approved scope: one lazy Google Ad Manager display slot after all answers on public QA pages. No community feed, profile, chat or private thread advertising. New inventory defaults off.

Ads owns a small current-approval store, accessed only in SERVICE context with forced RLS. Forum exports its public snapshot service, with an opaque hash over question/answer text, IDs, acceptance and update timestamps plus zone context. Ads never queries forum tables. The public page reads a fresh snapshot and sends its revision in the eligibility request. Current snapshot, rendered revision and reviewed revision must all match. Missing/unknown exam context fails closed; existing country, entitlement and child/teen rules remain authoritative.

The existing community admin screen previews the exact public question and all answers. EDITOR (or full admin) can approve that revision or revoke; both actions write metadata to the existing audit log. No user content is copied into that log. Edits, answer changes and visibility changes require review again. Eligibility is rechecked on page entry/session/subscription changes, without background polling or automatic ad refresh. Already open snapshots do not receive live moderation pushes.

Implementation slices: shared contracts and snapshot; Ads persistence/review gate; audited admin UI; public lazy slot; targeted unit, real-DB and browser checks; operator documentation. Google publisher/inventory/privacy approval and current public disclosures remain activation prerequisites. No production activation is part of this change.

## Verification

- 94 targeted API unit tests passed, including review gates, snapshot changes and existing ad/config regressions.
- Real PostgreSQL HTTP checks: 11 existing ad tests and 5 QA approval/audit/visibility/config tests passed; a subsequently added reviewer-erasure test passed in a focused run.
- All 20 distinct mobile/desktop browser scenarios passed across the targeted run and focused reruns. Synthetic SSR content and a mocked Google provider verify placement, narrow widths, one Google display, lazy loading, subscription teardown, no-fill, blocking, denial, provider errors, missing questions and English labels. Initial fixture CORS mismatch and Strict Mode eligibility-count expectations were corrected; one Google display remains explicitly asserted.
- Types/validation packages compiled; API, web and admin typechecks passed. Targeted lint had no errors; the existing admin forum page retains its pre-existing state-in-effect warning.
- Independent read-only review found no actionable issues, including the erasure follow-up. Full CI and production publisher/inventory validation were not run; no production flags were enabled.
