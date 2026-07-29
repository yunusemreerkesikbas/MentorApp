# Mentor Wrapped V1.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the weekly recap feel more personal and celebratory by strengthening its editorial voice, adding two deterministic weekly data stories, and constraining AI narration to a small aggregate evidence object.

**Architecture:** Coaching remains the only owner of recap metrics and localized dynamic messages. The existing `GET /v1/coaching/weekly-review` contract receives additive nullable rhythm fields; the web only renders them. AI keeps the cached `POST /v1/coach/weekly-review` response contract but moves to prompt v5 with an explicit PII-minimal evidence builder.

**Tech Stack:** NestJS, TypeScript, Drizzle, next-intl, Next.js, React, Vitest.

## Global Constraints

- No database migration or new endpoint.
- Only qualifying completed sessions contribute to recap metrics.
- Time calculations use Europe/Istanbul.
- Raw task titles, struggle notes, mood notes, or other user-authored text never enter the LLM prompt.
- AI never selects metrics, highlights, titles, or official exam facts.
- TR/EN static keys remain mirrored.
- Run only focused tests and checks for touched packages; no workspace-wide build or Playwright.

---

### Task 1: Add weekly focus-time and power-day aggregates

**Files:**
- Modify: `packages/types/src/coaching.ts`
- Modify: `apps/api/src/modules/coaching/domain/weekly-review.ts`
- Modify: `apps/api/src/modules/coaching/application/weekly-review.service.ts`
- Modify: `apps/api/src/modules/coaching/infrastructure/weekly-review.repository.ts`
- Test: `apps/api/src/modules/coaching/domain/weekly-review.spec.ts`
- Test: `apps/api/src/modules/coaching/application/weekly-review.service.spec.ts`

**Interfaces:**
- Produces `WeeklyFocusTimeBandId`, `rhythm.focusTimeBand`, and `rhythm.peakFocusDay`.
- `focusTimeBand` contains a backend-localized label/message plus aggregate minutes/session count.
- `peakFocusDay` is always available when qualifying focus exists, independent of the two-highlight cap.

- [x] Write failing domain tests for Istanbul band boundaries, duration aggregation, deterministic ties, and peak-day date ties.
- [x] Run only weekly-review domain/service tests and verify the new assertions fail.
- [x] Select `startedAt` in the repository and implement the pure aggregates.
- [x] Add the additive DTO fields and backend-localized messages.
- [x] Re-run the focused coaching tests.

### Task 2: Replace the broad AI payload with prompt v5 evidence

**Files:**
- Modify: `apps/api/src/modules/ai/domain/weekly-review-prompt.ts`
- Test: `apps/api/src/modules/ai/application/weekly-review-narration.service.spec.ts`

**Interfaces:**
- Produces `buildWeeklyReviewNarrationEvidence(review)`.
- Keeps `WeeklyReviewNarrationDto` and cache storage unchanged.
- Prompt receives title, selected highlights, rhythm aggregates, plan aggregates, performance aggregates, deterministic next step, and a title-derived editorial frame only.

- [x] Write failing tests for prompt version v5, explicit evidence shape, and absence of broad DTO/private fields.
- [x] Run only the weekly narration test and verify expected failures.
- [x] Implement the evidence builder and three-beat Wrapped voice instructions.
- [x] Re-run the focused AI test.

### Task 3: Refresh the deterministic Wrapped story copy

**Files:**
- Modify: `apps/web/messages/tr.json`
- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/src/app/[locale]/(app)/analysis/recap/_components/weekly-recap-story.tsx`
- Modify: `apps/web/src/lib/weekly-recap.spec.ts`

**Interfaces:**
- Focus support renders the localized focus-time message when present.
- Week-map reveal renders the localized peak-day message when present.
- Existing eight READY and adaptive PARTIAL composition remains unchanged.

- [x] Add failing pure assertions for the additive recap fields and presentation fallbacks.
- [x] Update TR/EN copy to a concise reveal/proof/punchline voice without claiming unproven growth.
- [x] Render the two backend-owned messages without adding frontend scoring.
- [x] Run only recap pure tests and mirrored-message validation.

### Task 4: Targeted verification and documentation

**Files:**
- Modify: `docs/features/coaching.md`
- Modify: `docs/features/ai.md`
- Modify: `docs/standards/api.md`

- [x] Append short feature timeline entries and additive service-catalog fields.
- [x] Run focused coaching and AI tests.
- [x] Run recap tests, touched-file lint, and targeted typechecks for `@mentor/types`, `@mentor/api`, and `@mentor/web`.
- [x] Inspect the final diff and report only the verified scope.
