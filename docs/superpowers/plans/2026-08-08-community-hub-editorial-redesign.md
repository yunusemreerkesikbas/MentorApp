# Community Hub Editorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the community workspace sidebar, featured discussion, continuing list, effort board, empty states, and buttons using the approved editorial hybrid direction.

**Architecture:** Keep the existing `HubShell` data flow and API contracts unchanged. Refactor only presentation markup, localized static copy, and community-scoped CSS; use the supplied static image through `next/image` and preserve the existing client fetch lifecycle.

**Tech Stack:** Next.js 16, React 19, next-intl, Tailwind CSS v4, Lucide icons, Vitest.

## Global Constraints

- Preserve Mentor DESIGN.md tokens and the 10px radius system.
- Keep all static copy mirrored in `messages/tr.json` and `messages/en.json`.
- Do not add dependencies or business logic.
- Keep focus indicators and minimum 44px interaction targets.
- Remove streak and XP/coin from the effort-board header.
- Do not modify files outside the W7 community surface and its feature documentation.

---

### Task 1: Lock the visual contract

**Files:**
- Create: `apps/web/src/app/[locale]/(app)/community/_components/community-hub-redesign.spec.ts`

**Interfaces:**
- Consumes: community component source and locale JSON files.
- Produces: a regression contract for the supplied image, Mentor wordmark, and requested removals.

- [x] Write a Vitest test that reads the production component sources and asserts `feed.png` and the new localized image-alt key are used, `messages_count` is absent from `zone-sidebar.tsx`, and `effort.streak` / `effort.xp` are absent from `hub-shell.tsx`.
- [x] Run the focused test and confirm it fails because the old presentation is still present.

### Task 2: Refactor workspace chrome and hub presentation

**Files:**
- Modify: `apps/web/src/app/[locale]/(app)/community/_components/community-header.tsx`
- Modify: `apps/web/src/app/[locale]/(app)/community/_components/zone-sidebar.tsx`
- Modify: `apps/web/src/app/[locale]/(app)/community/_components/hub-shell.tsx`
- Modify: `apps/web/src/app/[locale]/(app)/community/community-parity.css`
- Modify: `apps/web/messages/tr.json`
- Modify: `apps/web/messages/en.json`

**Interfaces:**
- Consumes: existing `ForumHubView`, `CommunitySummary`, `detailHref`, and join-zone behavior.
- Produces: the approved image-led featured card, compact sidebar/right panel, action-oriented empty states, and consistent buttons.

- [x] Change the header wordmark translation to Mentor and remove the mark background.
- [x] Remove zone icon tiles and thread-count sublines; reduce vertical spacing without shrinking interaction targets.
- [x] Rebuild the featured card with `next/image`, white/pastel surfaces, compact metadata, black primary action, and quiet secondary action.
- [x] Reduce continuing-row padding, remove hover animation and icon backgrounds, and retain focus-visible feedback.
- [x] Remove effort metrics; redesign the three columns and empty states without nested cards.
- [x] Add mirrored localized image-alt and empty-state action copy.
- [x] Run the focused test and confirm it passes.

### Task 3: Verify and document

**Files:**
- Modify: `docs/features/community.md`

**Interfaces:**
- Consumes: the completed presentation changes.
- Produces: the mandatory feature timeline entry and fresh verification evidence.

- [x] Append a concise timeline entry covering the redesign, usage, gotchas, and related files.
- [x] Run the focused Vitest file.
- [x] Run targeted web typecheck and lint for touched files.
- [x] Inspect the final diff and confirm no unrelated user files changed.
