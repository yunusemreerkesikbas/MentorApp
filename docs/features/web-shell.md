# Web shell & B2C UI

> The `apps/web` app shell: landing, app nav, layout, shared motion, cross-cutting UI polish.
> Workstream: cross-cutting (Sprint 1–3 polish series 0032–0042). The marketing surface + the
> authenticated shell every feature screen lives in.

## Overview

This is the `apps/web` shell — the marketing landing (`/`) and the authenticated app layout
(`(app)/layout` + `AppNav` tab bar/sidebar) that every feature screen (Panel, Plan, Seans, Analiz,
Bilgi, Koç, Profil, Abonelik, Hedef) composes into. It owns the shared motion utilities
(`stagger-motion.ts`), the prefix-safe active-nav matcher (`nav-active.ts`), the mobile tab-bar
offset helpers (`app-shell.ts`), and the B2C UI polish patterns (Nuton-token-faithful components,
framer-motion entrances, chip empty states, `useReducedMotion()` respect). It does **not** own
feature logic — each feature's UI is documented in its own feature doc.

## Architecture (key decisions)

- **Next.js App Router** — route groups `(app)` (authenticated) and `(auth)` (auth screens), plus
  public routes (`/`, `/bilgi/[slug]`). All under `src/app/[locale]/` after the i18n restructure
  (see [i18n.md](./i18n.md)).
- **DESIGN.md tokens, no magic numbers** — UI values come from `@mentor/ui` tokens (`Chip`, `Card`,
  `SectionHeading`, `Button`, `Field`, `SubmitButton`, `FormError`). Nuton thumb pastels for feature
  icons; active nav = `#111` not accent fill.
- **Shared motion** — `lib/stagger-motion.ts` (`staggerListVariants` / `staggerItemVariants`);
  `framer-motion` header fade + grid/section stagger; `AnimatePresence` for phase transitions and
  bubble/badge entrances. `useReducedMotion()` skips stagger/keyframes.
- **Prefix-safe active nav** — `lib/nav-active.ts` `isNavActive` fixes `/panel` falsely matching
  `/plan` prefix; `aria-current`, focus rings, 44px touch targets.
- **Link-as-CTA pattern** — `<Link>` styled as primary button (valid HTML — no `<button>` inside a
  link); used for `/seans`, `/panel`, success-funnel CTAs.
- **Mobile tab bar offset** — `lib/app-shell.ts` `MOBILE_TAB_BAR_STICKY_BOTTOM_CLASS` (63px +
  safe-area); used by layout and the koç composer sticky bar (replaces hardcoded `bottom-16`).

## Tutorials / Guides

```bash
pnpm --filter @mentor/web dev

# Public:
http://localhost:3000/                    # pre-auth welcome slider (first visit)
http://localhost:3000/giris               # return visitors after welcome seen
http://localhost:3000/bilgi/[slug]        # public SEO article

# Authenticated (after /giris):
http://localhost:3000/panel               # daily ritual hub
# Nav: Panel · Plan · Analiz · Bilgi · Koç · Profil (6 tab items on mobile)
```

- **Add a new `(app)` screen:** create `src/app/[locale]/(app)/<route>/page.tsx` (+ `_components/`),
  call `setRequestLocale(locale)` if it's a server page (else it falls to dynamic `ƒ`), add it to
  `app-nav.tsx` if it belongs in the tab bar, and reuse `stagger-motion.ts` for entrance animation.
- **New marketing block:** compose from `@mentor/ui` primitives + shared motion; keep CTAs as
  Link-as-button; respect `useReducedMotion()`.

## UI surfaces

| Surface | Route | Notes |
|---|---|---|
| Pre-auth welcome | `/` | 3-slide Puhu carousel; first visit only → then `/giris`; auth users → panel/onboarding |
| App nav | `(app)/layout` | DESIGN 63px tab bar + safe-area inset; sidebar on desktop; active top indicator (main color) |
| Auth shell | `(auth)/layout` | shared `AuthShell` (Mentor branding, motion card, "Ana sayfaya dön") |

## Geliştirmeler (timeline)

- **Lucide icon standard** — `apps/web` + web-facing `@mentor/ui` general icons now use
  `lucide-react` with direct `dist/esm/icons/*.mjs` imports (nav, back/add/play/send/chevron,
  notification, toast, form, button, streak/countdown glyphs). Admin `react-icons` remains out of
  scope; special SVGs like the circular timer stay custom. Related: `apps/web/src/lucide-icons.d.ts`,
  `packages/ui/src/lucide-icons.d.ts`. *(0067.)*
- **Profil UI** — `/profil` rebuilt as functional account hub: `ProfilShell` loads `GET /v1/users/me`
  + syncs `AuthProvider` via `setUserFromServer`; `ExamSettingsCard` (KPSS/YKS/LGS radiogroup,
  optimistic + rollback); `ProfileHeader` (Nuton thumb disc); `AccountLinksCard`; NotificationSettings
  refactor. `framer-motion` + `--color-accent` token added. *(0032.)*
- **Pre-auth welcome slider** — `/` 3-slide intro (companionship → AI coach → community); onboarding visual parity; `mentor_welcome_seen` localStorage. Marketing landing removed — future route TBD. *(0062.)*
- **App shell + nav polish** — `isNavActive` (prefix-safe); `AppNav` DESIGN 63px tab bar + safe-area
  inset + active top indicator + `aria-current`/focus rings/44px touch; `(app)/layout` min-h-screen
  shell bg + content padding clears tab bar. *(0041.)*
- **B2C UI polish cross-cutting sweep** — full verify (typecheck/lint/build green); `lib/app-shell.ts`
  shared mobile tab-bar offset classes; dead-code removal (`components/coming-soon.tsx` — all routes
  now have real screens); nav regression fix. Polish series index 0032–0041 consolidated. *(0042.)*
- **Stitch core overlay prompt set** — `.stitch/` Google Stitch project bundle: DESIGN.md subset,
  README workflow, 14 prompt files (00–13), asset guide, review checklist. Puhu mascot variant map +
  missing P0 variants (Thinking, Gentle-Error). Reserved `apps/web/public/mascot/puhu/`. Overlay
  primitives only — do not regenerate feature pages in Stitch. *(0055.)*
- **Stitch page design prompt plan** — extended Stitch scope from overlays-only to **full page
  content inside the existing shell**. Page inventory from live routes + roadmap tier markers
  (🆓/🔵/⭐); priority waves P0–P5 (daily loop → premium → content/account → abonelik → public funnel
  → topluluk); per-page widget specs + state matrix (happy/skeleton/empty/gate). 28 prompt files
  (mobile/desktop pairs). Shell is fixed — prompts must not redraw tab bar/sidebar. *(0060.)*
- **Post-login onboarding wizard** — `/onboarding` route group (no AppNav), 4-step wizard (welcome →
  exam required → goal skippable → complete); gate = `users.examType` (`postAuthDestination()` on
  login/signup + `(app)` layout); Puhu mascots; `onboarding.*` i18n namespace. Users with `examType`
  set go straight to `/panel`. Profil exam picker unchanged. *(0061.)*
- **Pre-auth welcome slider** — replaced `/` marketing landing with a 3-slide pre-auth welcome
  carousel (intro → AI coach → forum/community; Puhu + dash progress). First visit only
  (`localStorage mentor_welcome_seen`); return visitors → `/giris`; authenticated →
  `postAuthDestination()`. Removed `_components/landing/*` + `landing.*` i18n; shared `PuhuImage` +
  `DashProgress`. Separate from post-login onboarding. *(0062.)*
- **Toast notification stack** — Stitch "Mentor Puhu Design System" toast implemented in `@mentor/ui`
  + root `ToastProviderShell`. Usage in client components:
  `const { success, error, coach } = useMentorToast();` then
  `success({ title: "…", message: "…", duration: 3000, puhuVariant: "happy" })`. Puhu variants per
  toast type (overridable via `puhuVariant` / `leading`); error uses SVG icon (gentle-error PNG not yet
  designed). Viewport portals to `document.body`; z-index `100`; mobile 335px top-center, desktop 380px
  top-right. *(0063.)*
- **Dialog / modal** — Stitch Prompt 02 variants as one generic system in `@mentor/ui` +
  `DialogProviderShell` (inside toast shell). Usage:
  `const { confirm, info, promo } = useMentorDialog();`
  | Preset | Stitch use | Returns |
  |---|---|---|
  | `confirm({ title, message, confirmLabel, cancelLabel })` | Abonelik iptali | `Promise<boolean>` |
  | `info({ title, message, okLabel })` | Plan güncellendi | `Promise<void>` |
  | `promo({ title, message, badge?, primaryLabel, linkLabel?, puhuVariant? })` | Premium gate | `Promise<"primary" \| "link" \| "dismiss">` |
  Scroll lock: `html { scrollbar-gutter: stable }` + `html.mentor-dialog-open { overflow: hidden }`.
  *(0064.)*
- **Dialog MVP wiring** — `/abonelik` cancel: `confirm()` then success `info()` (`subscription.*`
  i18n); API errors → `FormError` with backend message. `/hedef` vision save: success `info()`
  (`vision.saved_info_*`); errors → `ApiClientError.body.message`. Panel overlay test strip removed.
  *(0065.)*
- **Toast MVP wiring** — daily loop surfaces: panel task DONE → `success()` after `GET /today`
  refresh with streak count (`panel.task_done_*` i18n); toggle/mood/seans card errors → `error()`
  toast (`common.error_title` + API message). Profil exam type save → `success()` (`profile.exam_settings.saved_toast_*`);
  inline `savedHint` removed. Mood encouragement stays inline in card (backend `message`). Seans
  complete uses `SessionDoneState` only (no success toast). **Overlay choice:** success/transient
  errors → toast; blocking confirmations / save ack → dialog; auth/form pages → `FormError`.
  *(0066.)*
- **Bottom sheet MVP wiring** — `@mentor/ui` action/filter layouts + `BottomSheetProviderShell`.
  Usage: `const { actionSheet, filterSheet } = useMentorBottomSheet();` then
  `await actionSheet({ title, actions, cancelLabel? })` → action id or `"cancel"`. Mobile: bottom
  slide-up (`animate-sheet-*`); desktop: centered max 480px card (no handle, `animate-dialog-*`
  scale/fade — no bottom slide). `/plan` task overflow (⋮) → action sheet
  (toggle done/pending + delete) → delete chains to `confirm()` dialog; action errors → toast.
  Filter layout built but not wired (`/analiz` backlog). **Overlay matrix:** transient success/error →
  toast; destructive confirm / save ack → dialog; contextual multi-action menu → bottom sheet.
  *(0067.)*
- **Global skeleton primitives** — `@mentor/ui` exports **animation-only** helpers:
  `MENTOR_SKELETON_SHIMMER_CLASS` (`.mentor-skeleton-shimmer`), `MENTOR_SKELETON_ENTER_CLASS`
  (`.mentor-skeleton-enter`), thin `<Skeleton className="…" />` wrapper, `<SkeletonGroup label={…}>`
  for a11y + enter fade. **Layout/shape is page-owned** — compose per screen in
  `*-content-skeleton.tsx` (e.g. `plan-content-skeleton.tsx`, `koc-content-skeleton.tsx`). Animations
  live in `theme.css`; `prefers-reduced-motion` respected. *(0068.)*

## Gotchas / Known issues

- **Secondary routes** (`/seans`, `/abonelik`, `/hedef`) — not in the tab bar; no item highlighted
  (by design). 6 tab items on mobile — dense but matches product nav; labels truncate on narrow screens.
- **Koç remains in nav** (product choice; Figma template shows 4 items).
- **Koç composer sticky offset** must stay aligned with `MOBILE_TAB_BAR_STICKY_BOTTOM_CLASS` when
  tab bar height changes.
- **Secondary hero CTA → `/giris`** (not `/bilgi` — app bilgi hub is auth-gated). Public SEO articles
  remain at `/bilgi/[slug]`. (Note: the marketing landing at `/` was later replaced by the pre-auth
  welcome slider — 0062; a future acquisition page will be a new route, e.g. `/tanitim`.)
- **Root `layout.tsx` was removed** — `<html>`/`<body>` + fonts + `globals.css` now live in
  `[locale]/layout.tsx` (awaited `params`, no dynamic read) so static render stays on (see [i18n.md](./i18n.md)).
- **Stitch frames:** mobile and desktop must be **separate Stitch screens** (01–06 mobile only;
  desktop is a separate run). One change per prompt — Stitch works best with incremental iteration.
- **Puhu PNGs** — runtime assets in `apps/web/public/mascot/puhu/` (incl. `puhu-surprised.png` for
  info toast). `gentle-error` variant still missing — error toast uses inline SVG. Remaining overlay
  primitives (`bottom-sheet`, `drawer`, etc.) follow same Stitch → `@mentor/ui` pattern as toast/dialog.
- **Economy/invite UI was backlog** at this sweep — now covered in [economy.md](./economy.md).

## Related

- Depends on: [i18n.md](./i18n.md) (locale routing, `[locale]` layout), [core/design-system.md](../core/design-system.md)
  (`@mentor/ui` tokens)
- Composes: every feature doc's "Web:" section
- Status: [core/mvp-status.md](../core/mvp-status.md) (cross-cutting)
