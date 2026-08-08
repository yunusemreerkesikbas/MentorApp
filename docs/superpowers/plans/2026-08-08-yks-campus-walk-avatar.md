# YKS Campus Walk + Student Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox tracking.

**Goal:** Extend the Selçuk pilot with an optional Street View walk mode, a lightweight student avatar, and more readable 3D stop cameras without weakening the preference simulation fallback.

**Architecture:** Keep the 3D map mounted as the spatial overview. Add a simulation-local Google loader adapter and a lazily constructed, reusable Street View panorama overlay. Resolve panorama coverage at runtime from POI coordinates; keep panorama IDs out of persistence. Drive the decorative avatar through a small explicit state machine derived from panorama movement events.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, next-intl, Google Maps JavaScript API (`maps3d` and `streetView`), Framer Motion, Vitest, Playwright.

## Global Constraints

- Do not add Three.js or custom 3D models.
- Do not load Google Maps on `/hedef`; keep all new code in the simulation client chunk.
- Preserve the 2D map, campus insights, and preference list when either Google mode fails.
- Reuse one `StreetViewPanorama` instance per route visit and never persist panorama IDs.
- Do not send panorama position, rank, program code, or other PII to analytics/Sentry.
- Mirror every static UI string in TR/EN and respect reduced motion.

---

## Task 1: Protect readable stop cameras

**Files:**
- Modify: `apps/api/src/modules/content/seed/selcuk-campus-seed.spec.ts`
- Modify: `apps/api/scripts/seed-selcuk-campus.mjs`

- [ ] Add a failing seed validation assertion that all stop presets retain at least 600 metres of range.
- [ ] Raise Selçuk stop ranges to 650–800 metres and reduce the steep tilt where needed.
- [ ] Make the seed validator reject future overly close presets.
- [ ] Run only the Selçuk seed spec and confirm green.

## Task 2: Centralize the Google loader

**Files:**
- Add: `apps/web/src/app/[locale]/(app)/vision-board/simulation/_components/google-maps-loader.ts`
- Modify: `apps/web/src/app/[locale]/(app)/vision-board/simulation/_components/campus-3d-map.tsx`

- [ ] Move one-time key, locale, region, weekly channel, and referrer configuration behind a shared function.
- [ ] Keep the 3D map behavior and simulation-only dynamic boundary unchanged.
- [ ] Surface missing-key and loader failures through the existing map fallback callback.

## Task 3: Add walk state behavior and Street View adapter

**Files:**
- Add: `apps/web/src/app/[locale]/(app)/vision-board/simulation/_components/campus-walk-state.ts`
- Add: `apps/web/src/app/[locale]/(app)/vision-board/simulation/_components/campus-walk-state.spec.ts`
- Add: `apps/web/src/app/[locale]/(app)/vision-board/simulation/_components/campus-street-view.tsx`

- [ ] Test movement, arrival, idle, reset, and stale-event transitions before implementation.
- [ ] Resolve the nearest panorama around the selected POI with a bounded radius.
- [ ] Report `AVAILABLE`, `UNAVAILABLE`, and `ERROR` without changing persisted content.
- [ ] Construct the panorama only after the user requests walk mode and reuse it thereafter.
- [ ] Translate panorama position/pano events into the avatar state machine.

## Task 4: Render the student avatar

**Files:**
- Add: `apps/web/src/app/[locale]/(app)/vision-board/simulation/_components/campus-walk-avatar.tsx`

- [ ] Draw a back-facing, product-themed 2.5D SVG avatar with no network asset.
- [ ] Animate walking and arrival states with Framer Motion.
- [ ] Disable all decorative motion for reduced-motion users.
- [ ] Keep the avatar pointer-transparent and clear of Google controls/attribution.

## Task 5: Integrate the hybrid experience

**Files:**
- Modify: `apps/web/src/app/[locale]/(app)/vision-board/simulation/_components/simulation-shell.tsx`
- Modify: `apps/web/messages/tr.json`
- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/e2e/preference-simulation.spec.ts`

- [ ] Add an accessible `Kuşbakışı / Yürüyüş` segmented control.
- [ ] Keep Street View mounted after first entry while visually switching layers.
- [ ] Return to aerial mode when selecting a different stop or starting the guided flyover.
- [ ] Keep previous/next navigation available and show calm coverage/error feedback.
- [ ] Add a mocked browser acceptance flow for coverage, entering walk mode, avatar visibility, and returning aerial.

## Task 6: Document and verify

**Files:**
- Modify: `docs/features/preference-simulation.md`

- [ ] Document the hybrid architecture, billing-sensitive lifecycle, coverage fallback, and usage.
- [ ] Run targeted API seed test, web state tests, focused Playwright spec, web typecheck, and touched-file lint.
- [ ] Leave the real-key desktop/mobile visual smoke test to the configured local environment.

