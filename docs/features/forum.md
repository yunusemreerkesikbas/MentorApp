# Forum — Q&A, Discussion Rooms & Discovery (`modules/forum` · W7b)

> Exam-scoped Q&A and discussion zones (`/topluluk`, `/topluluk/[slug]`), Discovery V2 feed &
> search, curated tags, helpful votes, polls, reactions, community-to-Puhu coach bridge, moderation
> queue, and public SEO Q&A pages (`/forum/soru/[id]`).

---

## 1. Overview & Architecture

`ForumModule` powers structured peer learning and discussion behind `forum.enabled`:

- **Single `Zone` Primitive, 3 Types:** `ANNOUNCEMENT` (staff/owner broadcast), `CHAT` (discussion & polls), and `QA` (questions, answers, helpful votes, and asker-accepted solutions).
- **Two-Plane Authorization (`forum.policy.ts`):** Platform staff (`MODERATOR`/`SUPER_ADMIN`) hold global moderation override; zone `OWNER` and `MODERATOR` members manage their own room (`/topluluk/[slug]/yonetim`).
- **RLS-Safe Author Resolution (`withAuthorCards`):** Because production Postgres enforces `FORCE ROW LEVEL SECURITY` on `users` (self-read only), all 13 forum thread/post/reaction read paths resolve public author display cards (`displayName`, `username`, `avatarUrl`) via the narrow service-context `withAuthorCards` helper (`infrastructure/forum-author-cards.ts`), verified by `forum-author-names-rls.e2e-spec.ts`.
- **Zero Coin in Forum (`AGENTS.md` §4 #3):** Accepted answers grant **XP only** (`forum.answer.accepted` domain event → `EconomyService`), never Coin.

---

## 2. Core Subsystems & Current Rules

### 2.1 Discovery Hub, Feed & Search (`/topluluk/uyeler/panel`, `/v1/forum/{hub,feed,trends,search}`)
- **Hub (`GET /v1/forum/hub`):** Returns featured thread, activity blend, exam-scoped trending tags (`/v1/forum/trends`), top supporters, and open room suggestions.
- **Unified Feed (`GET /v1/forum/feed`):** Supports `scope=relevant|following`, `sort=trending|recent|top` (empty first `trending` page falls back to `recent` via `effectiveSort`), `contentType=posts|questions`, and `unanswered=true` (others' unanswered Q&A).
- **Grouped Search (`GET /v1/forum/search?q=`):** Turkish `to_tsvector` GIN search returning threads, Q&A questions, public zones, tags, and public-safe member profiles (max 5 each).

### 2.2 Threads, Polls, Reactions, Bookmarks & Edits
- **Curated Tags & Suggestions:** Threads attach up to 3 curated tags (`/v1/forum/tags`); students can suggest new tags (`POST /v1/forum/tag-suggestions`) for `CONTENT_EDITOR` moderation.
- **Polls (`POST /v1/forum/polls/:pollId/votes`):** Optional single-choice anonymous poll on threads; vote counts stay hidden until the viewer votes or the poll closes.
- **Reactions & Helpful Votes:** Emoji reactions (`PUT/DELETE .../reactions`, paginated reactor list) and positive-only Q&A helpful votes (`helpful-vote`).
- **Owner Edit Window (`PATCH /v1/forum/{threads|posts}/:id`):** Authors can edit within the configured time window before answers/interactions lock the question context.

### 2.3 Community → Puhu Coach Bridge (`forum.coach_bridge.enabled`)
- `GET /v1/forum/threads/:id/coach-bridge` exposes structural eligibility so a student reading a forum thread can open `/koc/sohbet` (`contextCommunityThreadId`) and turn the discussion into a personal `COMMUNITY_COACH` study task (`POST /v1/coach/conversations/:id/plan-tasks`) without sending raw forum user content or PII to the LLM.

### 2.4 Moderation & Public SEO Q&A (`QAPage`)
- **Room & Platform Moderation (`/topluluk/[slug]/yonetim`):** `members-card.tsx` (approve/reject `REQUEST` joins, remove members) and `reports-card.tsx` (`OPEN` / `RESOLVED` tabs, `HIDE` with confirmation, `RESTORE`, or `DISMISS`, all recorded in the append-only audit log).
- **Public SEO (`/forum/soru/[id]`):** `@Public` SSR endpoint (`GET /v1/forum/public/questions/:id`) with `QAPage` JSON-LD and sitemap integration.
- **Reviewed Ad Placements (`2026-10-25..26`):** Exports SHA-256 `contentRevision` snapshots for editor-approved public Q&A (`forum.question.end`), authenticated community Q&A (`community.question.end`), announcements (`community.announcement.end`), and discovery overview (`community.overview`), consumed by [`AdsModule`](./ads.md).

---

## 3. API Surface

| Endpoint | Purpose |
|---|---|
| `GET /v1/forum/hub`, `GET /v1/forum/feed`, `GET /v1/forum/trends`, `GET /v1/forum/search` | Discovery hub, ranked cursor feed, tag trends, and grouped search |
| `GET\|POST /v1/forum/zones`, `GET /v1/forum/zones/:slug/feed` | List/create zones; single-request zone header + feed + pinned threads |
| `POST /v1/forum/zones/:id/{join,leave}`, `GET\|POST\|DELETE .../members*` | Room membership, `@mention` prefix search, and owner approvals |
| `POST /v1/forum/zones/:id/threads`, `GET\|PATCH /v1/forum/threads/:id*` | Create/read/edit Q&A questions and discussion threads |
| `POST /v1/forum/threads/:id/{answers,comments,accept/:postId,pin,restore}` | Q&A answers, comments, solution acceptance, pin, and mod restore |
| `PUT\|DELETE\|GET /v1/forum/{threads\|posts}/:id/{reactions,helpful-vote,bookmark}` | Emoji reactions, Q&A helpful votes, and saved bookmarks (`/v1/forum/bookmarks`) |
| `POST /v1/forum/polls/:pollId/votes` | Cast single immutable poll vote |
| `GET /v1/forum/tags`, `POST /v1/forum/tag-suggestions` | Active curated tags and student tag suggestions |
| `POST\|GET /v1/forum/reports*`, `POST /v1/forum/reports/:id/resolve` | Submit and resolve content reports (`HIDE` / `DISMISS`) |
| `GET /v1/forum/public/discovery` | Selected anonymous Q&A directory and sitemap source (`@Public`) |
| `GET /v1/forum/public/questions{,/:id}` | Existing anonymous Q&A references and direct detail (`@Public`) |
| `GET\|POST\|PATCH\|PUT\|DELETE /v1/admin/forum/{tags,tag-suggestions,featured-thread}` | Admin curated tags, tag suggestion review, and featured thread |

---

## 4. Geliştirmeler (Condensed Milestone Timeline)

- **2026-11-12 Anonymous community directory.** `/topluluk` explains the upcoming forum while it is closed. With `forum.enabled` on, an admin can set up to 50 comma-separated, moderation-reviewed UUIDs in `forum.discovery_question_ids`. Selected, eligible questions appear by exam in the directory and in the Turkish sitemap. With no eligible questions, the directory returns `noindex`. Removing a selection removes the question from discovery and changes its existing detail to `noindex`. An archived or private area, a removed question, or a question without visible answers is excluded by the existing eligibility rules. The setting selects IDs, so review edited content before keeping it in the directory. The signed-in Turkish hub is `/topluluk/uyeler/panel`. Related files include `forum-public.service.ts`, `forum-thread.repository.ts`, `[locale]/discover-community/page.tsx`, and `sitemap.ts`.

- **2026-10-25..26 — Content-Revision Verified Ad Snapshots:** Added deterministic SHA-256 `contentRevision` and `adContext` snapshot services for public Q&A, community Q&A, announcements, and discovery overview (`AdsModule` integration).
- **2026-10-08..10 — RLS Author Cards (`withAuthorCards`), Room Management UI & A11y Pass:** Fixed non-superuser RLS author name resolution across all 13 read paths, redesigned `/topluluk/[slug]/yonetim` (`members-card.tsx`, `reports-card.tsx`), and hardened mobile/screen-reader accessibility.
- **2026-08-08..16 — Community Hub Editorial Redesign, Reaction Details & Tag Suggestions:** Shipped Discovery V2 layout, paginated emoji reactor lists, and moderated student tag suggestions.
- **2026-07-31..08-01 — Community → Puhu Coach Bridge:** Shipped `/v1/forum/threads/:id/coach-bridge` and `COMMUNITY_COACH` plan-task provenance.
- **2026-06-22..07-25 — W7 Forum Foundation (Slices 1–6 & `APP-016–APP-023`):** Shipped zones, flat feed, Q&A acceptance, moderation queue, public SEO `QAPage`, attachments, bookmarks, polls, and follow feed (`Akış`).
