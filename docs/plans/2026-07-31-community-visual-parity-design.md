# Community Visual Parity Design

## Decision

Community routes use a dedicated full-screen product shell. The global Mentor desktop sidebar and
mobile tab bar are hidden while the user is inside `/community`; the Community shell owns its own
navigation, search, content canvas and contextual rail.

The supplied references are the visual source of truth for this slice. Existing forum behavior,
permissions, API contracts, localization, accessibility and anti-shaming product rules remain
unchanged. `DESIGN.md` tokens do not constrain typography, color, radius or spacing inside this
route-scoped visual system.

## Reference mapping

- Hub: reference 4 — editorial two-column hero, recent discussions and compact lower data bands.
- Global feed: reference 1 — fixed left navigation, dense center feed and contextual right rail.
- Composer: reference 2 — bordered white dialog, segmented post type, large fields and tag row.
- Thread and QA detail: reference 3 — wide reading column, simple discussion composer and flat replies.
- Room: reference 5 — breadcrumb toolbar, grouped room navigation and flatter channel timeline.

## Visual system

- Canvas: cool near-white `#f7f8fa`; content surfaces white; sidebar `#f5f6f8`.
- Ink: `#111318`; secondary `#69707d`; hairline `#e7e9ee`; primary action `#151b2c`.
- Typography: Inter-compatible system sans stack for the compact reference rhythm.
- Radius: 12–14px cards and fields, 10px controls, full pills only for tags/segments.
- Shadows: subtle `0 1px 3px rgba(16,24,40,.06)`; borders provide most separation.
- Desktop shell: 248px left rail, fluid center, 304px contextual rail. Hub uses the center+right area
  as one editorial canvas. Mobile collapses navigation/context into existing drawers and bottom sheets.

## Component behavior

No data-flow rewrite is required. Hub and feed keep parallel requests; ranking stays server-owned.
Cards retain capability menus, bookmark, share, reactions/helpful vote and attachments. The composer
keeps native dialog focus behavior and shared validation. Empty/loading/error states retain the same
contracts but adopt reference-matched geometry.

## Verification

Use touched-file lint, forum/web unit tests and web production build. Visual parity is reviewed
manually at 375, 768, 1024 and 1440px; no Playwright visual suite is added by request.
