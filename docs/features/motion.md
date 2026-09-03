# Motion — shared transitions (`@mentor/ui`)

> Cross-cutting UI motion layer. Recipes from transitions.dev, tokens aligned to DESIGN.md §9 (no elastic/bounce).

## What

CSS motion tokens + `t-*` recipe styles live under `packages/ui/src/transitions/`, imported by the web entry via `@import "@mentor/ui/transitions.css"` in `apps/web/src/app/globals.css` (alongside `theme.css`). Nested imports inside `theme.css` are unreliable with Tailwind/Next — do not rely on them.

## How to use

```tsx
import {
  DigitPopIn,
  NotificationBadge,
  TextSwap,
  ShimmerText,
  TextsReveal,
  ShakeField,
  SuccessCheck,
  SkeletonReveal,
  LikeBurst,
  CheckBox,
  SlidingTabs,
  Toggle,
} from "@mentor/ui";
```

- Prefer these primitives over ad-hoc Framer for chrome micro-motion (badges, tabs, shakes, digit updates, settings toggles).
- Infrequent numbers only for `DigitPopIn` (XP, days, goal minutes). **Not** live 1Hz session timers.
- `SegmentPillControl` and `PlanViewSwitcher` use `SlidingTabs` (CSS pill), not Framer `layoutId`.
- Notification drawer ALL/UNREAD uses `SlidingTabs` `variant="underline"`.
- Settings switches use `Toggle` (no bounce overshoot).

## Gotchas

- Nested `@import` inside package CSS is dropped by Tailwind/Next — `transitions/index.css` is a **flattened single file**, imported from `globals.css` as `@mentor/ui/transitions.css`.
- `SlidingTabs` sets pill `transition` inline so the slide still runs if recipe CSS is missing.
- `SlidingTabs` snap effect must key off stable tab **ids**, not `items` array identity — parents recreate that array every render and would snap-cancel the slide.
- Do not stack Framer scale and `LikeBurst` pop on the same node.
- `SkeletonGroup` optional `loading` + `revealed` enables `SkeletonReveal`; parent must reserve height.
- Deferred (YAGNI): input-clear dissolve, spinning counter, streaming text, full toast recipe swap.

## Related files

- `packages/ui/src/transitions/*.css`
- `packages/ui/src/components/transitions/*`
- `packages/ui/src/theme.css` (imports)
- `apps/web/src/components/segment-pill-control.tsx`
- DESIGN.md §9

## Geliştirmeler (timeline)

### 2026-09-04 — SlidingTabs slide fix

- **What:** Pill now animates on tab change. Root cause: `useLayoutEffect` depended on `items` array identity; consumers recreate that array every render, so the pill snapped before paint and the slide never showed.
- **Usage:** unchanged — `SlidingTabs` / `SegmentPillControl`.
- **Gotchas:** Snap only on mount/resize/structure (`itemsKey` of ids); animate on `value` change.
- **Related:** `sliding-tabs.tsx`.

### 2026-09-04 — Drawer underline tabs + Toggle

- **What:** Notification drawer ALL/UNREAD → `SlidingTabs` `variant="underline"` (sliding bar, same measure/tween as pills). New `Toggle` primitive + CSS (smooth travel, no bounce) wired on profile notification preference rows.
- **Usage:** `SlidingTabs` `variant="underline"` for underline chrome; `Toggle` from `@mentor/ui` for settings switches (`.is-init` only after first click).
- **Gotchas:** Gallery toggle bounce mapped to `--ease-smooth-out` / zero overshoot. Flatten `transitions/index.css` after recipe edits (no nested `@import`).
- **Related:** `notification-drawer-panel.tsx`, `sliding-tabs.tsx`, `toggle.tsx`, `toggle.css`, `notification-settings.tsx`.

### 2026-09-04 — SkeletonReveal expansions (client shells)

- **What:** Wired `SkeletonGroup` `loading`+`revealed` (SkeletonReveal) on community hub, knowledge, analysis, community member profile, leaderboard (summary + window board), and zone sidebar room list. Extracted shared skeleton blocks where Suspense fallbacks remain (`KnowledgeSkeletonBlocks`; analysis blocks for shell reuse). Subscription shell already compiled with the same pattern (verified, no change).
- **Usage:** Keep disabled/error early returns; drop `if (loading) return <Skeleton/>`; outer layout stays mounted; `readyBody` uses a min-height placeholder until data exists.
- **Gotchas:** Suspense-only fallbacks (e.g. knowledge page) stay mount/unmount — no shared parent tree. Multi-column layouts must wrap grid/flex inside the reveal layers (not on the outer `main` alone).
- **Related:** `hub-shell.tsx`, `knowledge-shell.tsx`, `analysis-shell.tsx`, `community/member/.../profile-shell.tsx`, `leaderboard-screen.tsx`, `zone-sidebar.tsx`, `subscription-shell.tsx`.

### 2026-09-04 — Shared transitions layer (transitions.dev → @mentor/ui)

- **What:** Motion tokens + recipe CSS (flattened `transitions/index.css`) + React primitives; wired notification badge, auth shake/checkbox, dashboard shimmer/text swap/reveal, SlidingTabs (plan/analysis/feed/calendar/roster), LikeBurst on community heart, DigitPopIn on XP/coin/countdown/session goal, SuccessCheck on session done / coach action / goal reached. SkeletonReveal live on my-coach, profile, and mentorship roster (grid-stack CSS + one-frame reveal delay).
- **Usage:** Import primitives from `@mentor/ui`; styles via `@import "@mentor/ui/transitions.css"` in web `globals.css`. `SkeletonGroup` `loading`+`revealed` for in-place skeleton→content.
- **Gotchas:** No live-timer digit animation; no bounce easings; nested CSS `@import` broken under Tailwind/Next — use flattened file; Suspense fallbacks stay mount/unmount (no shared tree); Framer remains for overlays/pickers.
- **Related:** files listed above.
