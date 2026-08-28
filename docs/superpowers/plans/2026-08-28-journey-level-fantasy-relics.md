# Gece Yolculuğu Fantastik Relik Ailesi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce and atomically integrate a complete 12-level fantasy relic family that remains readable from 48 px to 176 px without AI-slop ornament density.

**Architecture:** Store two transparent WebP variants per level behind a typed local artwork registry. `JourneyLevelMedallion` selects compact or hero artwork while existing API-derived level state, copy, accessibility, and celebration behavior remain unchanged. A build-time Sharp validator blocks incomplete, opaque, oversized, or incorrectly sized families.

**Tech Stack:** Next.js 16, React 19, TypeScript, `next/image`, Sharp, Vitest/Node test, Playwright.

**Spec:** `docs/plans/2026-08-28-journey-level-fantasy-relics-design.md`

## Global Constraints

- Do not use an owl, mascot, animal, character, text, number, outer hexagon, or shield plate in artwork.
- Fantasy richness comes from silhouette, material, light, and a small number of large jewels—not micro-runes, filigree, nested rings, or starfield noise.
- Keep all 12 existing `JourneyLevelKey` values, chapters, XP thresholds, API contracts, and TR/EN copy unchanged.
- Publish only when all 12 hero and all 12 compact assets pass validation.
- Preserve existing focus, dialog, reduced-motion, and visitor/owner privacy behavior.

---

### Task 1: Lock the artwork prompt system and Pusula V3 gate

**Files:**
- Modify: `docs/plans/2026-08-28-journey-level-fantasy-relics-design.md`
- Create after approval: `apps/web/public/journey-levels/relics/hero/compass.webp`
- Create after approval: `apps/web/public/journey-levels/relics/compact/compass.webp`

**Interfaces:**
- Consumes: The approved design spec and supplied visual references.
- Produces: The style anchor that every later relic uses as a reference image.

- [ ] Generate two Pusula V3 hero candidates by editing the approved V2 composition; preserve the large compass, wood backing, main amethyst, two cyan side stones, and one violet road.
- [ ] Reject candidates containing more than three engraved motifs, five spark accents, three nested structural rings, or four supporting stones.
- [ ] Render each candidate at 48, 96, and 176 px and score the five quality-gate dimensions from the design spec.
- [ ] Apply at most two single-purpose edits to the selected candidate; never combine silhouette, palette, and ornament changes in one edit.
- [ ] Create the compact variant from the approved hero by removing approximately one third of micro-detail, thickening the needle and outer metal edges, and reducing aura spread.
- [ ] Export actual-alpha WebP files at the specified dimensions and byte budgets.

### Task 2: Produce the remaining eleven relic pairs

**Files:**
- Create: `apps/web/public/journey-levels/relics/hero/{levelKey}.webp`
- Create: `apps/web/public/journey-levels/relics/compact/{levelKey}.webp`

**Interfaces:**
- Consumes: Approved Pusula V3 hero/compact pair and the twelve-level mapping in the design spec.
- Produces: Exactly 12 hero and 12 compact assets named by `JourneyLevelKey`.

- [ ] Produce the Uyanış trio first: `spark`, `trail`, and `compass`; compare all three together at 48 px before continuing.
- [ ] Produce Ahenk (`cycle`, `rhythm`, `flow`), then Derinleşme (`root`, `wing`, `horizon`), then Birlikte Işık (`lantern`, `star`, `constellation`).
- [ ] For each relic, generate two hero candidates with the shared Pusula V3 style reference and a level-specific subject delta.
- [ ] Select only candidates meeting 22/25 with no quality dimension below 4/5.
- [ ] Derive one simplified compact edit from every selected hero; do not independently redesign compact silhouettes.
- [ ] Review each chapter as a three-piece contact sheet before starting the next chapter to prevent style drift.

### Task 3: Replace the SVG/Puhu validator with the relic WebP contract

**Files:**
- Modify: `apps/web/scripts/journey-level-asset-validator.mjs`
- Modify: `apps/web/scripts/validate-journey-level-assets.mjs`
- Modify: `apps/web/scripts/journey-level-asset-validator.spec.mjs`

**Interfaces:**
- Produces: `validateJourneyLevelDirectory({ directory, expectedIds, variants })`, checking hero 1024/450 KiB and compact 256/80 KiB assets.

- [ ] Write failing tests for missing variant directories, missing/extra IDs, non-WebP input, wrong dimensions, missing alpha, opaque corners, and exceeded byte budgets.
- [ ] Change the production validator root from `public/journey-levels/puhu` to `public/journey-levels/relics`.
- [ ] Read metadata with Sharp and require `format === "webp"`, the exact square dimension, an alpha channel, and at least 95% transparent pixels in each 32×32 outer-corner sample.
- [ ] Run `pnpm --filter @mentor/web test:assets:journey-levels` and confirm all validator tests pass.
- [ ] Run `pnpm --filter @mentor/web assets:check:journey-levels` and confirm all 24 production assets pass.

### Task 4: Add the typed artwork registry and medallion rendering

**Files:**
- Create: `apps/web/src/components/journey-levels/journey-level-artwork.ts`
- Modify: `apps/web/src/components/journey-levels/journey-level-medallion.tsx`
- Modify: journey-level medallion call sites in the guide and celebration components.

**Interfaces:**
- Produces:

  ```ts
  export type JourneyLevelArtworkVariant = "compact" | "hero";

  export const JOURNEY_LEVEL_ARTWORK: Record<
    JourneyLevelKey,
    Record<JourneyLevelArtworkVariant, string>
  >;
  ```

- [ ] Extend the contract test to require both artwork variants for all catalog keys.
- [ ] Replace the numbered inline SVG with `next/image`; keep the wrapper `aria-hidden`, `data-journey-level-key`, and external sizing class.
- [ ] Add `variant?: JourneyLevelArtworkVariant` with `compact` as the default.
- [ ] Use compact artwork for the 48 px guide grid and 96 px profile; use hero artwork for the 112 px selected detail and 144–176 px celebration.
- [ ] Keep future artwork visibly identifiable with the existing reduced opacity plus reduced saturation/brightness; retain the existing lock icon and accessible state label.
- [ ] Load the 12-item guide grid lazily and the selected/celebration artwork eagerly.
- [ ] Remove the numbered fallback only in the same change that adds the complete, passing 24-asset family.

### Task 5: Verify the experience and document release behavior

**Files:**
- Modify: `apps/web/src/components/journey-levels/journey-level-contract.spec.ts`
- Modify: `apps/web/e2e/community-member-profile.spec.ts`
- Modify: `docs/features/community.md`
- Modify: `docs/features/economy.md`

**Interfaces:**
- Consumes: Complete asset family, validator, and medallion integration.
- Produces: Regression coverage and release documentation.

- [ ] Assert that current, completed, and future levels preserve their existing text, lock/check state, progress visibility, and accessibility names.
- [ ] Exercise 48, 96, 112, and 176 px rendering in light/dark themes and mobile/desktop guide layouts.
- [ ] Confirm future relics remain recognizable but visually subdued and that no information relies on color alone.
- [ ] Confirm the celebration retains reduced-motion behavior and does not introduce additional perpetual animation.
- [ ] Run the journey-level contract test and targeted community member profile E2E test.
- [ ] Run `pnpm --filter @mentor/web typecheck` and `pnpm --filter @mentor/web build` before declaring the slice release-ready.
- [ ] Append concise timeline entries explaining the new relic family, dual-WebP contract, atomic release gate, and relevant asset/component locations.

