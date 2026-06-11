# 0013 — Panel (Anasayfa / daily ritual hub) UI

> Date: 2026-06-10 · Scope: web + package (`@mentor/ui`) · Related: plan `docs/plans/2026-06-10-w1-w2-content-coaching-design.md` (Slice 2 daily loop, Slice 5 mood), DESIGN.md (Nuton tokens), AGENTS §4 #1/#5

## What was done
- Built the `/panel` screen (replaced the placeholder) as a **Server Component**: greeting, calm countdown, streak badge, today's plan list, start-session CTA, and mood check-in. Mobile-first single column → `lg` main + right-rail grid.
- Added six token-faithful primitives to `@mentor/ui`: `SectionHeading`, `DataCard` (guardrail #1 data-card render), `CountdownCard` (calm, blue accent — no alarm-red), `StreakBadge` (anti-shaming), `PlanListItem` (adapts Nuton list item 335×56), `MoodPicker` (1–5 radiogroup).
- Wired real data via `PanelShell` (`_components/panel-shell.tsx`): client-side `GET /v1/coaching/today` because the access token lives in memory (AuthProvider); matches the abonelik page pattern. Page-local client containers (`today-plan`, `mood-checkin`) handle the interactive bits.
- Grounded the layout via Figma MCP (Nuton file `8lc7t0P5kibfQ7GMzLSl3l`): confirmed `product ongoing` card (15:1173), `tag` (141:1736), `Tab bar` (5:761) match DESIGN.md tokens exactly.

## How to use (usage)
```bash
pnpm --filter @mentor/ui build      # required: web resolves @mentor/ui from dist/
pnpm --filter @mentor/web dev       # open http://localhost:3000/panel
```
- New primitives are exported from `@mentor/ui`; import and compose (no magic numbers — CSS-var tokens only).
- `PanelShell` loads `coachingControllerGetToday()` on mount; after a task toggle, it re-fetches `/v1/coaching/today` to refresh streak + motivational line (tasks stay optimistic in `TodayPlan`).
- Plan toggle calls `PATCH /v1/plan-tasks/:id`; mood select POSTs to `/v1/coaching/mood-checkins` and renders the response encouragement verbatim.

## Gotchas
- `@mentor/ui` is consumed as **compiled `dist/`** — after editing/adding components you must rebuild it before `@mentor/web` typecheck sees the new exports.
- The greeting name comes from the authenticated session via the composite `/today` payload, not hard-coded client-side.
- The countdown date is **authoritative content** (must come from `ContentService.getExamCalendar`, never `users.examDate`); `daysRemaining`/streak/completion are server-computed — never recompute on the client.
- `/seans` (Pomodoro) does not exist yet; the CTA links to a placeholder href.

## Related files & decisions
- `apps/web/src/app/(app)/panel/page.tsx`, `panel/_components/{panel-shell,today-plan,mood-checkin}.tsx`
- `packages/ui/src/components/{section-heading,data-card,countdown-card,streak-badge,plan-list-item,mood-picker}.tsx`, `packages/ui/src/index.ts`
- Decision: broadly reusable widgets live in `@mentor/ui` (each cites its DESIGN.md/Nuton basis); only stateful containers are page-local.
