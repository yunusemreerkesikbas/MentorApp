# Weekly Deep Analysis Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Provide a factual weekly deep analysis included with the existing recap acquisition.

**Architecture:** Coaching adds optional detail to its existing review snapshot. AI continues to
own report access and settlement. Web renders two views of the same acquired report.

**Tech Stack:** TypeScript, NestJS, next-intl, Next.js, Vitest, Playwright; no new dependencies.

**Spec:** [Approved design](2026-11-04-weekly-deep-analysis-design.md).

## Global constraints

- Preserve 250 Coin default and two acquisitions per rolling 30 days; no second charge/model call.
- Backend computes/localizes business facts; clients render them. No raw personal notes in detail.
- New detail is optional in existing JSON snapshots. No migration or new endpoint is needed.
- Preserve unrelated uncommitted work in the shared checkout.

## Review focus

- Absent prior week and absent subject exams must not become fake zero baselines.
- Negative nets and declines stay factual and use calm styling/copy.
- Older owned reports remain readable without recomputation or additional access checks.
- Switching views and opening archived reports must not trigger another acquisition/model request.
- Incomplete weeks keep the existing gate; Free users cannot fetch deep detail through previews.

## Task 1: Frozen backend detail

Files: `packages/types/src/weekly-deep-analysis.ts`, `packages/types/src/coaching.ts`,
`packages/types/src/index.ts`, coaching `domain/weekly-deep-analysis{,.spec}.ts`,
`application/weekly-review.service{,.spec}.ts`, `i18n/locales/{tr,en}/coaching.json`.

Produces: optional `WeeklyReviewDto.deepAnalysis`, containing backend-localized comparison rows,
subject rows and evidence qualification, saved as part of the existing review JSON.

- [ ] Write tests asserting two-week deltas, absent baselines, negative nets, taxonomy-only subjects
  and no raw titles; run focused tests and observe failure.
- [ ] Implement pure calculation/localization with explicit input/output types and wire the builder.
- [ ] Run new tests and existing weekly-review/policy/settlement tests with local Vitest.

## Task 2: Shared report views and entry points

Files: recap `weekly-deep-analysis.tsx`, `weekly-deep-analysis-subjects.tsx`,
`weekly-report-view.tsx`, `weekly-recap-entry.tsx`, `weekly-recap-shell.tsx`,
analysis `analysis-shell.tsx`, new `weekly-analysis-entry.tsx`, dashboard `membership-card.tsx`,
`messages/{tr,en}.json`, dedicated `e2e/weekly-deep-analysis.spec.ts`.

Consumes: the acquired `WeeklyRecapReportDto` and optional saved detail from Task 1.
Produces: `view=analysis` entry and local switching that reuses the already acquired report.

- [ ] Write browser scenarios for shared Coin/earned/Premium access and view switching, frozen
  legacy reports, missing evidence and TR/EN rendering.
- [ ] Implement token-based responsive reading view, original AI provenance and one plan-prefill
  CTA. Route all access through the existing offer/open flow.
- [ ] Add discoverability to ordinary analysis and correct the Premium benefit destination.
- [ ] Run browser tests at mobile/desktop widths plus touched-package type/lint checks.

## Task 3: Review and feature records

Files: `docs/features/{coaching,ai,economy}.md`, `docs/standards/api.md`.

- [ ] Record contract, usage, old-snapshot limitation and no-extra-charge/model behavior.
- [ ] Review access/privacy/payment invariants and inspect the final scoped diff.
- [ ] Record exact checks and remaining operational limitations; do not claim full CI readiness.
