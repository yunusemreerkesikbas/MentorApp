# 0056 — Forum Slice 5: Reports → Moderation queue

> Status: ✅ · Scope: `apps/api/src/modules/forum` · Flag: `forum.enabled`
> Design: [`docs/plans/2026-06-22-forum-community-design.md`](../plans/2026-06-22-forum-community-design.md) §9 (slice 5) · roadmap §"Moderasyon" · Prior: [0052](./0052-forum-slice1-zones.md)–[0054](./0054-forum-slice3-qa.md)

## What shipped

The human-driven moderation loop — finally activates the dormant W6 "Moderation queue ⛔ needs
forum" item. A user **reports** a thread/answer; the zone's **owner/mod** (or **platform staff**,
override) sees it in a queue and **hides / restores / dismisses** it; every action lands in an
append-only audit.

**Locked decisions:** report + queue only (no Tier-1 auto-detect, no threshold auto-hide — later);
targets = threads + answers; **hide = soft-delete** (reuse `deleted_at`), **restore** clears it (no
separate status column); backend-only (`apps/admin` not in repo yet); forum module owns it (admin app
is a client). No coin.

## Data model (migration `0024_stale_kinsey_walden.sql`)

- `forum_reports` — `target_type` (THREAD|POST), `target_id`, `zone_id` (denormalized for the queue),
  `reporter_id`, `reason` (SPAM|HARASSMENT|OFF_TOPIC|OTHER), `note?`, `status` (OPEN|RESOLVED|DISMISSED),
  `resolved_by`/`resolved_at`. **uniqueIndex(target_type, target_id, reporter_id)** → idempotent re-report.
- `forum_moderation_actions` — append-only audit: `actor_id`, `actor_scope` (ROOM|PLATFORM),
  `action` (HIDE|RESTORE|DISMISS), target, `zone_id`, `reason?`. **No UPDATE/DELETE RLS policy** ⇒
  immutable (like `ledger_entries`).
- Both tables: all access in SERVICE context, app-policy-gated (mirrors the member-list pattern).

## Usage

```http
POST /v1/forum/reports                 { "targetType":"THREAD|POST", "targetId":uuid, "reason":..., "note?":... }  # any authed user, @Throttle, idempotent
GET  /v1/forum/zones/:id/reports?status=OPEN     # room queue — owner/mod/staff
GET  /v1/forum/reports?status=OPEN               # platform queue — staff only
POST /v1/forum/reports/:id/resolve     { "action":"HIDE|DISMISS" }   # owner/mod of the report's zone, or staff
POST /v1/forum/threads/:threadId/restore         # owner/mod/staff
POST /v1/forum/answers/:postId/restore           # owner/mod/staff
```

## How it works

- **Hide = soft-delete.** `resolve {HIDE}` calls the existing `softDelete` on the thread/post repo, so
  the item immediately drops out of **every** read path (feed, question detail, search) — those all
  filter `deleted_at IS NULL`. No read-path changes were needed.
- **Restore** clears `deleted_at` via new `restore` repo methods + a service-context
  `findByIdIncludingDeleted` (RLS user-reads hide soft-deleted rows, so restore must read in SERVICE).
- **Authz** reuses `forum.policy`: `canModerateZone` (zone owner/mod OR platform staff) for
  queue/resolve/restore; `isPlatformStaff` for the global queue. `actor_scope` on each audit row =
  PLATFORM if staff else ROOM.
- **Both surfaces, one row:** a report is a single `forum_reports` row; the room queue (per-zone
  endpoint) and the platform queue (global endpoint) both read it — no duplication. A room owner can't
  bury it because platform staff see the same row globally.

## Gotchas

- **Reporting requires the target be visible** to the reporter (service loads it in user-context →
  soft-deleted/invisible target → 404). Reporting an already-hidden item isn't possible.
- **`status` filter:** the queue endpoints accept `?status=` (typically OPEN). Pagination is offset
  (`total` is the page length — same lightweight approach as the member/search lists; switch to a real
  count if a deep queue needs it).
- `forum_moderation_actions` is **append-only** — there is no edit/delete path by design (audit).

## Tests

`pnpm --filter @mentor/api exec vitest run src/modules/forum test/forum.e2e-spec.ts` → **50 passing**
(policy 9 · zone 7 · thread 6 · qa 6 · moderation **9** · economy listener 3 · e2e **10**). E2e covers:
report (+idempotent re-report) → global & zone queues show it → non-mod resolve 403 → staff HIDE →
thread gone from feed → restore → back.

## Next

Tier-1 auto-detection (profanity/regex + Turkish normalization) + threshold auto-hide = a later
slice. Web/admin moderation UI = frontend track. Slice 6 = SEO (QA SSR + JSON-LD + sitemap).
Verification tiers / coin / C-layer = Phase 2.
