# 0054 — Forum Slice 3: Q&A (questions, answers, accepted answer, XP, search)

> Status: ✅ · Scope: `apps/api/src/modules/forum` + `modules/economy` (XP listener) · Flag: `forum.enabled`
> Design: [`docs/plans/2026-06-22-forum-community-design.md`](../plans/2026-06-22-forum-community-design.md) §9 (slice 3) · Prior: [0052](./0052-forum-slice1-zones.md), [0053](./0053-forum-slice2-feed.md)

## What shipped

QA zones become a Stack-Overflow-style surface: members ask **questions** (titled threads), post
**answers** (`forum_posts`), the asker **accepts** one answer (one-shot), the answerer earns **XP**,
and questions are **full-text searchable**.

**Locked decisions:** XP only on accepted answer (→ answerer); accept is **one-shot/final** (no
un-accept/switch — anti-farm); search = QA questions (title+body) only; ask/answer require **ACTIVE
membership** (reading open to any authed user). No coin (§4 #3). No answer voting/reactions (Phase 2).

## Data model (migration `0023_wealthy_jack_power.sql`)

- `forum_threads` (ALTER): `title` (nullable; QA only), `status` (OPEN/ANSWERED), `accepted_post_id`
  (uuid, **no FK** — avoids circular threads↔posts FK, app-enforced).
- `forum_posts` (NEW): QA answers — `thread_id`, `author_id`, `body`, `is_accepted`, soft-delete,
  timestamps. RLS mirrors `forum_threads`; `set_updated_at` trigger.
- **Search:** expression GIN index `to_tsvector('turkish', coalesce(title,'')||' '||body)` on
  `forum_threads` — **no stored column, no trigger, no dep**. Queried with
  `… @@ websearch_to_tsquery('turkish', $q)` ranked by `ts_rank`. Not in `schema.ts` (drizzle won't
  manage a raw index it didn't generate → no drift).

## Usage

```http
# ask: QA zone requires a title (service-enforced); reuses the slice-2 thread endpoint
POST   /v1/forum/zones/:id/threads     { "title": "...", "body": "..." }   # ACTIVE member
POST   /v1/forum/threads/:threadId/answers   { "body": "..." }            # ACTIVE member, @Throttle
GET    /v1/forum/threads/:threadId                                         # QuestionDetail (q + answers, accepted first)
GET    /v1/forum/threads/:threadId/answers
POST   /v1/forum/threads/:threadId/accept/:postId                          # asker-only, one-shot → 409 if already accepted
DELETE /v1/forum/answers/:postId                                           # author or owner/mod → 204
GET    /v1/forum/search?q=<term>&zone=<slug?>&page=&pageSize=              # QA questions, ranked
```

## XP wiring (decoupled via events)

`accept` does `setAccepted` + `setQaAccepted` then **`emitAsync('forum.answer.accepted', {…})`**.
`economy/application/forum-events.listener.ts` (`@OnEvent`) grants XP to the answerer:
`EconomyService.grant(answerAuthorId, XP, config['forum.xp.accepted_answer'], {refType:'forum.answer.accepted', refId: postId})`
— idempotent on the post id, self-guards on `economy.enabled`. Forum has **no runtime dependency** on
economy (type-only import of the event), mirroring `quest-events.listener` ← payments.

`emitAsync` (not `emit`) so the grant completes before `accept` returns — the answerer's balance is
correct immediately (and the e2e is deterministic).

## Authz (`forum.policy.ts`)

- `canPostInZone` extended: QA → ACTIVE member or owner/mod/staff (same gate as CHAT) — covers both
  ask and answer.
- `canAcceptAnswer(actor, questionAuthorId)` → asker-only, **no staff override** (MVP).
- Answer delete reuses `canDeleteThread` (author or owner/mod/staff).

## Gotchas

- **One-shot accept:** `accept` rejects with `409 FORUM_ALREADY_ANSWERED` when `status==='ANSWERED'`
  or `accepted_post_id` is set. Un-accept / switching accepted answer = Phase 2.
- **`accepted_post_id` has no FK** (`ponytail:` documented) to avoid the circular threads↔posts
  constraint; the service guarantees the post belongs to the thread before setting it.
- Search `q` is normalized by the same `'turkish'` config on both index and query, so stemming is
  consistent; a question is indexed regardless of zone visibility but the search join filters to
  visible (RLS) QA zones.
- XP is **uncapped** by design (economy caps apply to coin only); the accepted-answer idempotency
  (refType/refId) is the anti-double-grant guard.

## Tests

`pnpm --filter @mentor/api exec vitest run src/modules/forum src/modules/economy/application/forum-events.listener.spec.ts test/forum.e2e-spec.ts`
→ forum policy 9 · zone svc 7 · thread svc 6 · qa svc 6 · economy listener 3 · e2e 12 (incl. the full
QA flow: ask→answer→non-member 403→accept→XP balance→re-accept 409→search hit/miss→delete).

## Next (Slice 4/5)

Slice 4 = search polish (if needed); Slice 5 = report → moderation queue (room + platform override,
`moderation_actions`); Slice 6 = SEO (QA SSR pages, `QAPage` JSON-LD, sitemap). Web UI (2b/QA) still
pending. Voting/coin verification/C-layer = Phase 2.
