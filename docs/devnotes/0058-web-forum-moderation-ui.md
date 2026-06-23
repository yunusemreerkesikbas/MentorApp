# 0058 — Web slice B: forum moderation tools, approvals, search

> Status: ✅ (static gate) · Scope: `apps/web` (`/topluluk/[slug]/yonetim`, inline mod actions, search) + small `ZoneView` backend add · Flag: `forum.enabled`
> Prior: [0057](./0057-web-forum-core-ui.md) (web core) · backend [0052](./0052-forum-slice1-zones.md)–[0056](./0056-forum-slice5-moderation.md)

## What shipped

The owner/mod web surfaces on top of the slice-A participation UI: a per-zone **management page**
(pending-member approval + report queue with hide/dismiss/restore), **inline pin/delete** on feed
items, and a **QA search bar** on the index.

## Backend prep (small)

`ZoneView` gained **`myRole`** (viewer's zone role) + **`canModerate`** (owner/mod here, or platform
staff) so the FE can gate mod tools without 403-probing. `forum.service.toView(row, count, membership,
actorRoles)` computes them via `isPlatformStaff`; `getZone`/`listZones` now take the actor's roles
(threaded from the controller's `user.roles`). Additive to the API contract.

## Screens / components (`apps/web`)

- **`/topluluk/[slug]/yonetim`** (`ManageShell`): `getZone` → redirect to the zone if `!canModerate`.
  - `PendingMembers` — `listZoneMembers(zoneId,'PENDING')` → **Approve** only (see gotcha).
  - `ReportQueue` — OPEN/RESOLVED toggle; OPEN → Gizle (`resolveReport HIDE`)/Yoksay (`DISMISS`); RESOLVED → Geri al (`restoreThread`/`restoreAnswer` by `targetType`).
- **Zone detail** — "Yönetim" link + `canModerate` passed to `ThreadItem`.
- **`ThreadItem`** — when `canModerate`: Sabitle/Kaldır (`pinThread`, optimistic re-sort) + Sil (`deleteThread`, optimistic remove).
- **`/topluluk` index** — `ReadyContent` adds a search form → `searchQuestions(q)` → results as `QuestionListItem` links; clear → groups.
- `lib/forum.ts` += `searchQuestions`, `listZoneMembers`, `approveMember`, `listZoneReports`, `resolveReport`, `restoreThread`/`restoreAnswer`, `pinThread`, `deleteThread`/`deleteAnswer`.

## Decisions / gotchas

- **Approve-only (no Reject):** the backend `approveMember(false)` is a no-op (leaves PENDING — slice-1 C5); member removal has no endpoint yet, so a Reject button would mislead. Deferred until a removal endpoint exists.
- **Restore lives in the queue:** hidden content (soft-deleted) isn't visible in the member feed, so the only reachable restore is the RESOLVED tab of the report queue.
- **Inline mod = feed only:** `zone.canModerate` is known on the zone detail; the QA question-detail screen has no zone-role context, so QA content is moderated via the report queue (not inline).
- **Inline delete is `window.confirm`-gated** (no modal infra). Restore-gap: a mod's inline delete of an **un-reported** thread has no in-UI restore path (restore lives on the report queue's RESOLVED tab, which needs a report row). Backend `POST /threads/:id/restore` exists; a "my deletions" mod view is a later slice.
- **`react-hooks` setState-in-effect:** effects use the inline `.then`/async-IIFE pattern (no synchronous `setState` in the effect body, no named-callback fetch) — calling a setState-ing fn directly from an effect trips the rule.
- **api-client not regenerated** (Docker/Postgres was down → `openapi:export` couldn't boot). Harmless here: the web `http<T>` wrappers read `ZoneView` straight from `@mentor/types`, not generated types. Regen the client when the stack is back so `openapi.json` reflects `myRole`/`canModerate`.

## Verification

- **Static gate (green):** `pnpm --filter @mentor/web typecheck && lint && build` ✓ (`/topluluk/[slug]/yonetim` dynamic route built; tr+en); repo `pnpm typecheck` 13/13. Lint 0 errors (lone pre-existing `seans-shell` warning).
- **Forum backend suite: NOT run this turn** — the local test Postgres (:5433, docker) is down, so vitest `global-setup` (migrate) fails. The `toView`/signature change is typecheck-clean and `forum.service.spec` was updated to the new `listZones` arity. Re-run once the DB is up: `pnpm db:up && pnpm --filter @mentor/api exec vitest run src/modules/forum test/forum.e2e-spec.ts`.
- **Preview (manual, needs stack + mod session):** as a zone OWNER/staff → "Yönetim" → approve a pending member; report a message (2nd user) → queue → Gizle → leaves feed → RESOLVED tab → Geri al; inline Sabitle/Sil on a feed item; `/topluluk` search a QA term → results link to the question; non-mod → `/yonetim` redirects away, no inline mod actions.

## Next

A member-removal/reject endpoint (to make Reject real); author display names (backend identity join);
SEO (slice 6). Optionally regen api-client + run the forum suite once the DB is back.
