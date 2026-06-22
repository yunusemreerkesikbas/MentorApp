# 0053 — Forum Slice 2: thread feed + reactions + pin

> Status: ✅ · Scope: `apps/api/src/modules/forum` (+ `@mentor/{types,validation}`) · Flag: `forum.enabled`
> Design: [`docs/plans/2026-06-22-forum-community-design.md`](../plans/2026-06-22-forum-community-design.md) §9 (slice 2) · Slice-1 devnote: [0052](./0052-forum-slice1-zones.md)

## What shipped

The content layer on top of Slice-1 zones — the "duyuru + sohbet" surface. Members post into
**CHAT** zones and read **ANNOUNCEMENT** broadcasts, react with a fixed emoji set, and owners/mods
pin items. **Flat feed only** (one-level `forum_threads`); replies + QA answers (`forum_posts`)
arrive in Slice 3. **No XP/economy** yet (Slice 3). No coin anywhere (§4 #3).

## Data model (migration `0022_daffy_ben_urich.sql`)

- `forum_threads` — `zone_id`, `author_id`, `body`, `is_pinned`, `deleted_at`/`deleted_by` (soft-delete),
  timestamps. No `kind` column: behaviour is derived from the parent zone's `type` (YAGNI).
- `forum_reactions` — `(thread_id, user_id, emoji)` unique; emoji constrained to
  `FORUM_REACTION_EMOJIS` in the app layer.
- RLS mirrors slice 1: user-context reads (non-deleted threads to any authed user; own reactions to
  self), all privileged writes + reaction-count aggregates run in SERVICE context.

## Usage

```http
# member posts (CHAT needs ACTIVE membership; ANNOUNCEMENT needs owner/mod/staff)
POST   /v1/forum/zones/:id/threads        { "body": "..." }      # @Throttle 20/min
GET    /v1/forum/zones/:id/threads?limit=30&before=<ISO>          # cursor feed (pinned first)
POST   /v1/forum/threads/:threadId/pin    { "pinned": true }      # owner/mod/staff
DELETE /v1/forum/threads/:threadId                                 # author or owner/mod/staff → 204
PUT    /v1/forum/threads/:threadId/reactions    { "emoji": "👍" } # one of FORUM_REACTION_EMOJIS
DELETE /v1/forum/threads/:threadId/reactions    { "emoji": "👍" } # → 204
```

`GET …/threads` returns `{ items: ThreadView[], nextCursor }`; each `ThreadView` folds in
`reactionCounts` (emoji→count) and the viewer's own `myReactions` — both via **batched** lookups
(`reactionCountsByThread` / `myReactionsByThread`), no N+1.

## Authz (two-plane — `forum.policy.ts`)

- `canPostInZone(actor, zoneType, memberStatus)` — ANNOUNCEMENT → owner/mod/staff; CHAT → ACTIVE
  member or staff.
- `canDeleteThread(actor, authorId)` — author OR owner/mod/staff (soft-delete; row kept for audit).
- `canPinThread` = `canModerateZone`.

## Gotchas

- **Cursor is heuristic** (`ponytail:` in `forum-thread.service.ts`): a full page sets `nextCursor` to
  the last item's `createdAt`; worst case is one empty trailing fetch. Switch to a `limit+1`
  lookahead if it ever matters.
- **Rate-limit is a static `@Throttle(20/min)`**, not yet config-driven — `ponytail:` note left to
  wire `forum.post.rate_per_min` once abuse data warrants. No per-message Turnstile (a captcha can't
  be solved per message); rate-limit is the control.
- `forum_reactions` has **no `updated_at`** → no `set_updated_at` trigger (only `forum_threads` gets one).
- Pinned ordering: feed sorts `is_pinned desc, created_at desc`; the `before` cursor filters purely on
  `created_at`, so pinned items show on the first (no-cursor) page.

## Tests

`pnpm --filter @mentor/api exec vitest run src/modules/forum test/forum.e2e-spec.ts` → **30 passing**
(policy 7 · zone service 7 · thread service 6 · e2e 10). E2e covers: member-post→feed, non-member
403, ANNOUNCEMENT member-403/staff-201, react/unreact toggle, pin-floats-to-top, author soft-delete.

## Next (Slice 3)

QA zone behaviour: question/answer (`forum_posts`), accepted answer, **XP events** wired to economy
(`forum.answer.accepted` → `EconomyService.grant`), full-text search.
