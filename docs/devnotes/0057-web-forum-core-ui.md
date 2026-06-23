# 0057 — Web UI: forum/community core participation

> Status: ✅ (static gate) · Scope: `apps/web` (`/topluluk/**`, panel card, nav, i18n) · Flag: `forum.enabled`
> Plan: `.claude/plans` Web slice · Backend: devnotes [0052](./0052-forum-slice1-zones.md)–[0056](./0056-forum-slice5-moderation.md)

## What shipped

The first B2C web surface for the forum (backend was complete behind `forum.enabled`). Core
participation only — deferred to a later Web slice: owner/mod moderation queue UI, member-approval
UI, search UI, pin/restore UI.

**Screens** (`apps/web/src/app/[locale]/(app)/topluluk/**`, server `page` → client `*-shell`):
- `/topluluk` — zone index, grouped Duyuru/Sohbet/Soru-Cevap; flag-off → "yakında" empty state.
- `/topluluk/[slug]` — zone detail; branches on `zone.type`: CHAT/ANNOUNCEMENT → flat feed (composer + emoji reactions + cursor "load more"), QA → question list + ask composer. Join button when not a member.
- `/topluluk/soru/[threadId]` — question detail (answers, accepted-first), answer composer, asker-only accept, report on question + answers.

**Entry (locked decision):** panel card (`community-card.tsx`, flag-aware probe — renders nothing on
`FORUM_DISABLED`, mirrors `EconomySection`) + desktop **sidebar-only** nav link (`app-nav.tsx`
`sidebarOnly` flag; mobile tab bar stays at 6). No 7th mobile tab.

**Feed freshness (locked):** manual cursor "load more" + reload-on-action; no auto-poll.

## Patterns reused (no new infra)

- Data layer `lib/forum.ts` = typed `http<T>` wrappers + `isForumDisabled(err)` (mirrors `lib/economy.ts`).
- `@mentor/ui` `Card`/`Button`/`Chip`/`TextField`/`SectionHeading`; `components/form.tsx` `FormError`.
- probing/disabled/error/ready state machine (from `EconomySection`); flag-off detected via `ApiClientError.body.code === 'FORUM_DISABLED'`.
- All copy via next-intl `topluluk` namespace (tr+en parity) + `nav.community`; backend `ApiError.message` rendered verbatim.
- `@/i18n/navigation` for links; `setRequestLocale` in every `page.tsx`.

## Decisions / gotchas

- **Reactions optimistic:** local count/`myReactions` toggle immediately; backend returns `{status:'ok'}` (no counts), so we mutate locally and **revert on error** (`applyReaction` in `zone-shell.tsx`).
- **Multi-line input = token-styled `<textarea>`** (the `TextField` primitive is single-line).
- **Report = inline reason chips** (`_components/report-button.tsx`, shared) — no modal infra; idempotent server-side so a re-report just shows "received".
- **ANNOUNCEMENT composer:** shown to ACTIVE members; a non-mod post 403s and the composer surfaces the backend message (FE has no zone-role hint in `ZoneView`).
- **Answering** likewise relies on the backend 403 for non-members (the question detail has no membership hint); the localized message is shown inline.
- **`useEffect` + setState:** effects use the inline async-IIFE pattern (not a named async callback) — calling a named setState-ing fn from an effect trips `react-hooks` "setState synchronously in effect". `load()` (for accept/answer reloads) stays a `useCallback` used only by handlers.
- **Author identity not shown:** `ThreadView`/`AnswerView` carry only `authorId` (no display name); items show time + body. Author mini-card needs a backend join → deferred.

## Verification

- **Static gate (green):** `pnpm --filter @mentor/web typecheck && lint && build` ✓ (`/topluluk` static, `[slug]`/`soru/[threadId]` dynamic, tr+en generated); repo `pnpm typecheck` 13/13. Lint: 0 errors (1 pre-existing warning in `seans-shell.tsx`, not ours).
- **Live happy-path (manual — needs the stack up):** set `forum.enabled=true` (admin config) + seed one CHAT/ANNOUNCEMENT/QA zone with a staff account; start api+web; visit `/topluluk` → group view → join a CHAT zone → post → react/unreact (count updates) → load more; QA zone → ask → open question → answer (2nd session) → accept (asker) → report a reason. Flag-off → panel card hidden + `/topluluk` "yakında".

## Next

Web slice B: owner/mod moderation queue + member-approval + search UI + pin/restore. Author display
name (needs a backend identity join on thread/answer/report views). SEO (slice 6).
