# Forum

> Community Q&A and discussion zones (curated staff creation, scoped membership, flat feed + Q&A +
> moderation + SEO). Module: `modules/forum`. Workstream: W7 (pulled from Phase 2 into MVP).
> Roadmap: MVP slice 1–6 complete; Phase 2 adds verification tiers, coin rewards, C-layer, mahalle, live rooms.

## Overview

The forum is the community surface — a Stack-Overflow-style Q&A zone plus chat/announcement zones,
scoped membership, human-driven moderation, and public SEO for discoverability. It was pulled from
Phase 2 into the MVP behind `forum.enabled` (default off). **No coin in forum** (§4 #3).

## Architecture (key decisions)

- **One `Zone` primitive, three behaviours:** `ANNOUNCEMENT` / `CHAT` / `QA`. Zone type determines
  which features are available (feed vs questions+answers). "Mahalle" is a future config of the same
  model, not a new domain.
- **Two-plane authz** (`forum.policy.ts`): platform role (global override) vs zone role (scoped to one
  zone). Curated zone creation (staff only); external community leaders become zone `OWNER`.
- **Join policies:** `OPEN` → ACTIVE instantly; `REQUEST` → PENDING + `forum.member.requested` event.
- **Flat feed** (`forum_threads`) + QA answers (`forum_posts`) — no nested replies in MVP.
- **XP on accepted answer only** — event `forum.answer.accepted` → `EconomyService.grant` (idempotent,
  uncapped). Forum has no runtime dependency on economy.
- **Full-text search:** Turkish `to_tsvector` expression GIN index on QA questions (title+body).
- **Public SEO:** `@Public` API + SSR QA pages + `QAPage` JSON-LD + sitemap + robots (TR-only index).
- **Moderation:** report → queue → hide/restore/dismiss (append-only audit). No Tier-1 auto-detect yet.

## Tutorials / Guides

```bash
# Enable the feature (admin, per-environment):
PATCH /v1/admin/config/forum.enabled { "value": true }

# Staff creates a curated zone:
POST /v1/forum/zones { "type": "QA", "title": "KPSS Genel", "joinPolicy": "OPEN" }

# User joins + posts + answers + accepts:
POST /v1/forum/zones/:id/join
POST /v1/forum/zones/:id/threads { "title": "...", "body": "..." }
POST /v1/forum/threads/:threadId/answers { "body": "..." }
POST /v1/forum/threads/:threadId/accept/:postId

# Moderation:
POST /v1/forum/reports { "targetType": "THREAD", "targetId": "<uuid>", "reason": "SPAM" }
GET  /v1/forum/zones/:id/reports?status=OPEN
POST /v1/forum/reports/:id/resolve { "action": "HIDE" }

# Run forum tests:
pnpm db:up && pnpm --filter @mentor/api db:migrate
pnpm --filter @mentor/api exec vitest run src/modules/forum test/forum.e2e-spec.ts
```

Web UI: `/topluluk` (zone index, grouped Duyuru/Sohbet/Soru-Cevap). `/topluluk/[slug]` (zone detail
with feed or QA). `/topluluk/[slug]/yonetim` (mod tools — pending members + report queue).
Public SEO: `/[locale]/forum/soru/[id]` (SSR, TR-indexed, JSON-LD).

## API

| Endpoint | Purpose |
|---|---|
| `GET /v1/forum/zones` | List zones (filter by type, examType) |
| `POST /v1/forum/zones` | Create zone (staff) |
| `POST /v1/forum/zones/:id/join` | Join zone (OPEN→ACTIVE, REQUEST→PENDING) |
| `GET /v1/forum/zones/:id/members` | List members (owner/mod) |
| `POST /v1/forum/zones/:id/members/:userId/approve` | Approve pending member |
| `DELETE /v1/forum/zones/:id/members/:userId` | Reject pending or remove active member (owner/mod/staff; OWNER protected) |
| `POST /v1/forum/zones/:id/threads` | Post thread/ask question |
| `GET /v1/forum/zones/:id/threads` | Cursor feed (pinned first) |
| `POST /v1/forum/threads/:threadId/answers` | Post QA answer |
| `GET /v1/forum/threads/:threadId` | Question detail (q + answers) |
| `POST /v1/forum/threads/:threadId/accept/:postId` | Accept answer (asker, one-shot) |
| `PUT/DELETE /v1/forum/threads/:threadId/reactions` | Toggle emoji reaction |
| `POST /v1/forum/threads/:threadId/pin` | Pin/unpin thread |
| `POST /v1/forum/reports` | Report content |
| `GET /v1/forum/zones/:id/reports` | Room moderation queue |
| `GET /v1/forum/reports` | Platform moderation queue |
| `POST /v1/forum/reports/:id/resolve` | Hide/dismiss report |
| `POST /v1/forum/threads/:threadId/restore` | Restore hidden thread |
| `GET /v1/forum/search?q=` | Full-text search (QA only) |
| `GET /v1/forum/public/questions/:id` | Public QA (SSR, @Public) |
| `GET /v1/forum/public/questions?limit=` | Public QA refs (sitemap) |

## Geliştirmeler (timeline)

- **Slice 1 — Zones + membership** — one Zone primitive (ANNOUNCE/CHAT/QA), two-plane authz,
  scoped membership, `forum.enabled` flag. *(0052.)*
- **Slice 2 — Flat feed + reactions + pin** — `forum_threads` + `forum_reactions`, cursor feed,
  CHAT/ANNOUNCEMENT surface. *(0053.)*
- **Slice 3 — Q&A + XP + search** — `forum_posts`, question/answer, accepted-answer XP,
  Turkish full-text search, one-shot accept. *(0054.)*
- **Slice 5 — Moderation** — `forum_reports` + `forum_moderation_actions` (append-only audit),
  hide/restore/dismiss, room + platform queues. *(0056.)*
- **Web A — Core participation UI** — `/topluluk/**` (zone list, feed, QA, join, report),
  panel card, sidebar-only nav. *(0057.)*
- **Web B — Mod tools + search** — `/topluluk/[slug]/yonetim` (pending members, report queue),
  inline pin/delete, QA search. *(0058.)*
- **Slice 6 — SEO** — `@Public` QA reads, SSR page, `QAPage` JSON-LD, sitemap, robots (TR-only index). *(0059.)*
- **Admin UI — Zone yönetimi** — Admin panele "Topluluk" menüsü eklendi (`SUPER_ADMIN`/`ADMIN`). `/forum` zone listesi, `/forum/new` zone oluşturma formu. Backend'e dokunulmadı — mevcut `POST /v1/forum/zones` staff authz'u kullanılıyor. *(APP-016)*
- **Unified Layout + Author Display (APP-016)** — Discord benzeri zone sidebar (in-flow, masaüstü) + CSS transform mobile drawer; `ThreadView`/`AnswerView`'e `authorName: string` eklendi (LEFT JOIN users); `ZoneView`'e `emoji` alanı eklendi (DB migration + admin form); zone detail sayfasına sağ panel (zone bilgisi + pinned gönderiler); `AuthorAvatar` (deterministik pastel, initials); `relativeTime` helper (`Intl.RelativeTimeFormat`); `zone-shell-skeleton`. *(APP-016)*
- **Member reject & removal (APP-017)** — `DELETE /v1/forum/zones/:id/members/:userId` endpoint eklendi (aktif üye çıkarma + pending reddetme). `approveMember(false)` artık satırı PENDING'de bırakmak yerine siliyor. Policy'e `canRemoveMember` (OWNER çıkarılamaz). Repo'ya `findMembershipPrivileged` eklendi (`withServiceContext` — servis bağlamında güvenli role lookup). Web `/yonetim` sayfası iki tab'a genişledi: Bekleyenler (onayla/reddet) + Aktif Üyeler (kaldır); tab butonlarına `aria-pressed` eklendi. DB migration yok. Unit test: 37 → 45 (policy × 4 + service × 4). *(APP-017)*

## Gotchas / Known issues

- **`forum.enabled` default off** — flip per-environment to go live.
- **Zone olmadan B2C boş görünür** — `forum.enabled = true` olsa bile `forum_zones` tablosu boşsa `/topluluk` "Henüz bir alan yok" gösterir. Üretime çıkmadan önce admin panelinden (`/forum/new`) en az bir zone oluştur.
- **Slug is server-derived** from title + `Date.now()` base-36 suffix (curated, low volume).
- **Accept is one-shot/final** — no un-accept/switch (anti-farm). 409 on re-accept.
- **`accepted_post_id` has no FK** — avoids circular threads↔posts constraint; app-enforced.
- **Author identity** — `ThreadView`/`AnswerView` include `authorName` via LEFT JOIN `users.displayName` (coalesced to `""`). UI shows `t("unknown_author")` when empty.
- **Member removal: OWNER çıkarılamaz** — `canRemoveMember` OWNER rolünü bloklar; OWNER devri ayrı feature (backlog).
- **Restore lives in the queue** — hidden content isn't visible in the member feed; the only
  reachable restore is the RESOLVED tab of the report queue.
- **Forum endpoints have no OpenAPI response schema** — web uses raw `fetch` + `@mentor/types`.
- **Migration not auto-applied in some setups** — run `pnpm db:up && pnpm db:migrate` once.
- **Tests need the DB** — vitest `globalSetup` migrates real Postgres before any spec.
- **Unit tests: 45 green** (forum module spec'leri — policy + zone + thread + QA + moderation). E2E testler ayrı çalışır (`pnpm db:up && pnpm db:migrate` sonrası).

## Related

- Design doc: [`plans/2026-06-22-forum-community-design.md`](../plans/2026-06-22-forum-community-design.md)
- Slice-1 plan: [`plans/2026-06-22-forum-community-slice1-plan.md`](../plans/2026-06-22-forum-community-slice1-plan.md)
- Seam: [economy.md](./economy.md) (XP on accepted answer), [i18n.md](./i18n.md) (topluluk namespace)
- Status: [core/mvp-status.md](../core/mvp-status.md) (W7 breakdown)
