# Forum / Community — Development Design / Plan

> Date: 2026-06-22 · Status: design (pre-implementation) · Scope: `apps/api` (`modules/forum` — greenfield), `apps/web` (public `/forum/**` + in-app forum screens), `apps/admin` (moderation queue), `packages/{ui,validation,types}`
> Canonical context: [`AGENTS.md`](../../AGENTS.md) (guardrails §4) · [`docs/architecture.md`](../architecture.md) (module map) · [`docs/workstreams.md`](../workstreams.md) · [`DESIGN.md`](../../DESIGN.md) (tokens) · [`sinav-kocluk-roadmap.md`](../../sinav-kocluk-roadmap.md) (§2 forum, §4 moderation, §9 data model) · standards under [`docs/standards/`](../standards).
> Product decisions in this doc are **LOCKED** by the product owner (brainstorming session 2026-06-22). This doc grounds them in the current codebase and turns them into an implementation plan.

---

## 1. Overview & scope

Forum/community was Phase 2 in [`docs/mvp-status.md`](../mvp-status.md); the product owner pulled a **lazy, scoped slice into the MVP**. The driver is an existing audience (e.g. large WhatsApp KPSS groups) to migrate — which removes the classic "empty forum" cold-start risk that originally justified deferral.

**Core decision: one `Zone` primitive, three behaviours.** Forum, chat rooms, and announcements are not separate domains — they are one table differentiated by `type`. "Mahalle" (closed cohort) is **not built now**; it is a future *configuration* of the same model (`visibility=PRIVATE` + auto-assign), not new code.

| Behaviour | Zone `type` | Maps to |
|---|---|---|
| Announcement (1→many, read + react) | `ANNOUNCEMENT` | WhatsApp duyuru kanalı |
| Open chat (many↔many, flat feed) | `CHAT` | Discord room / WhatsApp sohbet |
| Q&A (question → answers → accept) | `QA` | StackOverflow-style forum |

**New bounded context:** `forum` (`apps/api/src/modules/forum`). Mahalle/community is **not** a separate module. Layer depth (Pragmatic Clean): `controller + service + repository` + a framework-free `forum.policy.ts` (room-role authz) + `forum.events.ts`. The heavy verification state machine (3-tier, coin, C-layer) is **Phase 2**, so full 4-layer ceremony is not warranted in MVP.

**Current codebase state (verified 2026-06-22):**
- `forum` module **does not exist** — greenfield (reserved only in `modules/README.md`).
- No `ModerationAction` table/module exists anywhere (`apps/api/src` grep: only config-catalog thresholds). The moderation surface is **introduced by this work** — confirms mvp-status "Moderation queue ⛔ needs forum".
- `EconomyService.grant(userId, Currency.XP, amount, { reason, refType, refId })` exists and is **idempotent on `(refType, refId)`** — XP reward path is reused as-is, no economy change.
- Cross-module triggers use `@OnEvent(Topic)` listeners; event types live in `<module>/domain/<module>.events.ts`.
- `pgvector` enabled; Postgres full-text (`tsvector`) needs no extension. Next.js App Router already does SSR + public ISR ([devnote 0050](../devnotes/0050-web-i18n-next-intl.md)).

**MVP boundary (locked):**

| In MVP | Phase 2 (same model, flag/listener only) |
|---|---|
| Zones: `ANNOUNCEMENT` + `CHAT` + `QA`, all `PUBLIC`, **staff-created (curated)** | Coin rewards · weighted voting · 3-tier verification state machine · C-layer snapshot+embedding |
| External room **OWNER** (curated assignment) + per-room `MODERATOR`/`MEMBER` | Self-serve zone creation by users |
| Join policy `OPEN` or **`REQUEST` → owner approves** | `PRIVATE` zones + invite-token · **mahalle** (closed, auto-assign) + friend rooms |
| Threads + replies, **accepted answer** (QA), pin, tags, reactions | "Share session to room" (closed rooms only) · @mention notifications |
| Postgres full-text **search** | websocket/presence · leaderboard (Redis) · identity badges |
| Report → soft-delete → moderation queue (room + platform) · rate-limit + Turnstile | coach approval tier (needs coach role) |
| **XP** for post-created (rate-limited) + accepted-answer | — |
| SEO: QA indexable (quality-gated), CHAT/ANNOUNCEMENT `noindex` | AI-crawler policy tuning · forum→knowledge-center cross-surfacing (never) |

---

## 2. Guardrail alignment (AGENTS §4)

| Guardrail | Where it lands |
|---|---|
| **#1 — Official info never LLM-generated; forum is low-authority** | Forum lives in its own `/forum` URL namespace, **never merged into the authoritative `/bilgi` knowledge center**. QA content is rendered + SEO-labelled "topluluk / deneyimsel (düşük-otorite)". Feeding verified answers into AI (C-layer snapshot + embedding) is **Phase 2 only** — no forum text reaches the LLM in this scope. |
| **#3 — Coin non-monetary; no coin in chat zone** | **No coin anywhere in MVP forum.** Only XP is granted, and only for `post-created` (rate-limited) + `accepted-answer`. Reactions earn nothing (anti-farming). `moderation_actions` is **append-only** (never edited/deleted), mirroring the ledger discipline. |
| **#5 — AI→teacher trust line** | No coach role in MVP; coach approval tier deferred. No raw user content routed to any coach surface. |
| **#6 — KVKK** | External room OWNER gets **scoped** powers on their zone only — **no admin panel, no other zones, no raw PII**. Reports always route to the **platform** queue too, so a room owner cannot bury them. CHAT/ANNOUNCEMENT are `noindex` to avoid public exposure of conversational content. No behavioral data; no embeddings in MVP. |
| **#7 — org/coach-ready schema** | `forum_zones.org_id` is **nullable** from day one (global rows = `NULL`). `forum_zone_members.role` already models delegated, scoped authority — the data shape supports org-scoped zones and coach owners later with no migration rewrite. |

---

## 3. Authorization model (two planes)

Authz is the only genuinely "critical" logic here, so it is isolated in a framework-free `forum/domain/forum.policy.ts`.

- **Plane 1 — Platform role** (`users.role`: STUDENT/EDITOR/ADMIN…). Global. Admin panel, override on **all** zones, PII.
- **Plane 2 — Room role** (`forum_zone_members.role`: `OWNER` | `MODERATOR` | `MEMBER`). Scoped to **one zone**.

| Action | Allowed when |
|---|---|
| Read public zone / threads | any authenticated user |
| Create thread / reply / react in a zone | authenticated user (zone not archived; rate-limited) |
| Accept an answer | thread author (asker) only |
| Approve/reject join request, remove member, pin, hide post **in a zone** | that zone's `OWNER`/`MODERATOR` **or** platform staff |
| Create/archive a zone, assign OWNER | platform staff only (curated) |
| Resolve report, hide/restore/delete any content, suspend a room owner | platform staff (override on every zone) |

**Double belt:** app-layer policy check **+** Postgres RLS. Reads on public zones allowed to any authenticated session; mutations checked by policy; `withUserContext` (`SET LOCAL`) on every repository call.

---

## 4. Data model (Drizzle, appended to `database/schema.ts` in a `/* ===== forum ===== */` block)

Follows existing conventions: `uuid` PK `default(sql\`gen_random_uuid()\`)`, `timestamp(..., { withTimezone: true })`, snake_case columns / camelCase TS, indexes via `(t) => [...]`, `set_updated_at()` trigger in the migration.

| Table | Key columns |
|---|---|
| `forum_zones` | `type` (ANNOUNCEMENT/CHAT/QA), `title`, `slug` (uniq), `description`, `visibility` (default PUBLIC), `join_policy` (OPEN/REQUEST), `exam_type` (nullable, for filtering), `org_id` (nullable), `created_by`, `is_archived` (bool), timestamps |
| `forum_zone_members` | `zone_id`, `user_id`, `role` (OWNER/MODERATOR/MEMBER), `status` (ACTIVE/PENDING), timestamps · **uniq(`zone_id`,`user_id`)** |
| `forum_threads` | `zone_id`, `author_id`, `title` (nullable; CHAT msgs may be titleless), `body`, `kind` (QUESTION/DISCUSSION/ANNOUNCEMENT/MESSAGE), `status` (OPEN/ANSWERED), `accepted_post_id` (nullable), `is_pinned`, `tags text[]`, `reply_count` (denormalized), `search_tsv tsvector`, `deleted_at`/`deleted_by` (soft-delete), timestamps · **GIN(`search_tsv`)**, **GIN(`tags`)**, index(`zone_id`,`created_at`) |
| `forum_posts` | `thread_id`, `author_id`, `body`, `is_accepted`, `search_tsv tsvector`, `deleted_at`/`deleted_by`, timestamps (replies/answers) · index(`thread_id`,`created_at`) |
| `forum_reactions` | `target_type` (THREAD/POST), `target_id`, `user_id`, `emoji`, `created_at` · **uniq(`target_type`,`target_id`,`user_id`,`emoji`)** |
| `forum_reports` | `target_type`, `target_id`, `zone_id`, `reporter_id`, `reason`, `status` (OPEN/RESOLVED/DISMISSED), `resolved_by`/`resolved_at`, `created_at` |
| `moderation_actions` | `actor_id`, `actor_scope` (ROOM/PLATFORM), `action` (HIDE/DELETE/RESTORE/REMOVE_MEMBER/SUSPEND_OWNER), `target_type`, `target_id`, `zone_id`, `reason`, `created_at` — **append-only audit** |

**Unified shape:** CHAT/ANNOUNCEMENT render `forum_threads` as a flat feed (no replies, or replies as light chat); QA uses `forum_threads` = question + `forum_posts` = answers, with `accepted_post_id` set by the asker. One model, three behaviours.

`search_tsv` is a generated/maintained column over `title`+`body` using the `turkish` text-search config; populated via trigger or generated column in the migration.

---

## 5. Event flow (existing `EventEmitter`; no synchronous cross-module chains)

Events declared in `forum/domain/forum.events.ts` (`module.entity.action` strings):

```
forum.thread.posted    → notifications: REQUEST-zone owner gets "new content / pending member"
forum.answer.created   → notifications: question author gets "cevabın geldi"
forum.answer.accepted  → economy.grant(XP, refType='forum.answer.accepted', refId=postId)  [idempotent]
                       → notifications: answer author
forum.post.created      → economy.grant(XP, refType='forum.post', refId=postId)  [idempotent, rate-limited]
```

- XP **only** on post-created (rate-limited via config) + accepted-answer. **Reactions grant nothing** (anti-farming; reactions are an engagement signal). **No coin** (§4 #3).
- Notifications reuse the existing `JobQueuePort` + W5 notification pipeline. No direct economy/notifications table access — forum emits, they listen.

---

## 6. API surface (`/v1/forum`, all Zod-validated, lists paginated, messages localized server-side)

| Group | Endpoints |
|---|---|
| Zones | `GET /zones` (paginated; filter `type`/`exam_type`/`tag`) · `GET /zones/:slug` · `POST /zones` *(staff)* · `PATCH /zones/:id` *(staff/owner)* |
| Membership | `POST /zones/:id/join` (OPEN→ACTIVE, REQUEST→PENDING) · `GET /zones/:id/members` *(owner/mod)* · `POST /zones/:id/members/:userId/approve` *(owner/mod)* · `DELETE /zones/:id/members/:userId` *(owner/mod)* |
| Threads | `GET /zones/:id/threads` (cursor-paginated, `?after=`) · `POST /zones/:id/threads` · `GET /threads/:id` · `PATCH /threads/:id` · `DELETE /threads/:id` · `POST /threads/:id/accept/:postId` *(asker)* · `POST /threads/:id/pin` *(owner/mod)* |
| Posts | `GET /threads/:id/posts` (paginated) · `POST /threads/:id/posts` · `PATCH /posts/:id` · `DELETE /posts/:id` |
| Reactions | `PUT /:targetType/:id/reactions` · `DELETE /:targetType/:id/reactions` |
| Search | `GET /search?q=&zone=&type=` (Postgres `tsvector`, `turkish` config) |
| Reports / moderation | `POST /reports` · `GET /reports` *(owner/staff)* · `POST /reports/:id/resolve` *(owner/staff)* |

Conventions: `Paginated<T>`, ISO-8601 UTC, uuid IDs, plural kebab-case nouns, `ApiError { code, message, details? }`, HTTP codes per backend standard (`409` on duplicate join/reaction idempotency replay, `429` on rate limit, `403` on policy denial). OpenAPI → `@mentor/api-client` orval codegen. Validation schemas appended to `@mentor/validation` (shared FE+BE).

---

## 7. Realtime & security

- **No websocket.** Chat/feed freshness via polling (`GET .../threads?after=cursor`). `ponytail:` transport stays REST + polling; websocket+Redis (presence/typing) is Phase 2 if mass arrives — same API, only transport changes.
- **Rate-limit** per-user on post/thread create (config registry tunable) + **Cloudflare Turnstile** at the write boundary (anti-spam/Sybil).
- **Reports route to both** the room owner/mod **and** the platform queue — a room owner cannot bury a report.
- **Soft-delete** (`deleted_at`); hard delete is a platform-staff capability logged to `moderation_actions`.
- **`forum.enabled`** config-registry feature flag gates the whole surface (risky-rollout discipline, like `economy.enabled`).

---

## 8. SEO

Rendered by the existing Next.js App Router SSR/ISR stack — near-zero new infra. **Indexing is a policy decision, not code.**

| Zone type | Indexing | Reason |
|---|---|---|
| `QA` | **indexable** (SSR + ISR) | "4/A 4/B farkı" type queries are the acquisition channel |
| `CHAT` | `noindex` | conversational noise; KVKK exposure risk |
| `ANNOUNCEMENT` | `noindex` (MVP) | low SEO value |

- **Thin-content gate:** only QA threads with **≥1 answer** are indexed; unanswered questions stay `noindex` until answered (avoids thin-page penalty).
- **`/forum` namespace** kept separate from authoritative `/bilgi`; forum is labelled low-authority and **never cross-surfaced into knowledge-center pages** (§1).
- Per QA thread page: `generateMetadata` (title/description/canonical) + **`QAPage` JSON-LD** + `robots` derived from zone type + answer count.
- Dynamic `sitemap.ts` lists only indexable QA threads; ISR revalidation on new/accepted answer.

---

## 9. Slice order (thin vertical slices, each end-to-end: schema → migration → repo → service → controller → api-client → web → devnote)

| # | Slice | Unlocks |
|---|---|---|
| 1 | **Zone + membership core** (model, CRUD, staff-create, OWNER assign, join OPEN/REQUEST→approve, `forum.policy.ts`, feature flag) | Rooms exist; authz spine |
| 2 | **Threads + replies + reactions + pin** (CHAT + ANNOUNCEMENT feeds) | WhatsApp migration usable (announce + chat) |
| 3 | **QA** (question/answer, accepted answer, XP events) | Q&A behaviour + economy wiring |
| 4 | **Search** (Postgres full-text) | Q&A discoverability |
| 5 | **Reports + moderation queue** (room + platform override, `moderation_actions`, admin UI) | Safety net; activates dormant W6 queue |
| 6 | **SEO** (QA SSR pages, JSON-LD, sitemap, robots policy) | Acquisition channel |

---

## 10. Testing (DoD)

- **Unit (framework-free domain):** `forum.policy.ts` (platform-vs-room authz matrix), accept-answer flow, XP idempotency (refType/refId), thin-content/index decision.
- **Integration (repository + RLS):** `withUserContext` tenancy, pagination, full-text search, join `REQUEST→approve` transition, soft-delete visibility.
- **E2E:** join request → owner approval; report → platform override hide; rate-limit `429`; feature-flag off → `404`.
- CI green (`pnpm typecheck && lint && build`); service catalog ([`docs/standards/api.md`](../standards/api.md)) + devnote updated per slice.

---

## 11. Open items (calibrated later, not blocking)

- Post/thread rate-limit values + XP amounts → config registry, tuned from live data (reward ≤ action value).
- Curated OWNER onboarding flow (how staff invite/verify a WhatsApp admin) — operational, lightweight; assignment endpoint is in slice 1.
- QA thin-content threshold (≥1 answer vs accepted-only) — start at ≥1, revisit with data.
