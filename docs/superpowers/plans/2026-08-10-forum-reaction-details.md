# Forum Reaction Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a LinkedIn-style reaction summary that opens a responsive, filterable, paginated list of people and also lets the viewer add or replace their reaction.

**Architecture:** Keep reaction identity in the forum bounded context. Add additive thread/post list endpoints backed by service-context repository reads after the existing visibility checks. The web renders a compact summary and opens the shared responsive bottom-sheet/dialog primitive; the panel owns its loading, filter, pagination, and optimistic selection state.

**Tech Stack:** NestJS, Drizzle/Postgres RLS, Zod, shared TypeScript contracts, Next.js 16/React 19, `@mentor/ui` bottom sheet, Vitest.

## Global Constraints

- One reaction per target and user; selecting another emoji replaces it.
- Every list endpoint is offset-paginated with a maximum page size of 100.
- Reaction identities are returned only after the viewer passes the target's existing visibility check.
- Static UI copy is mirrored in Turkish and English.
- No new carousel, modal, cache, or state-management dependency.

---

### Task 1: Shared reaction-list contract

**Files:**
- Modify: `packages/types/src/forum.ts`
- Modify: `packages/validation/src/forum.ts`
- Modify: `apps/api/src/modules/forum/presentation/forum.dto.ts`

**Interfaces:**
- Produces: `ReactionUserView`, `ReactionUsersPage`, `ReactionListQuery`, `ReactionListQueryDto`.

- [ ] Add a reaction user view containing public user identity, emoji, and reaction timestamp.
- [ ] Add a paginated response alias and `paginationQuerySchema` extension with optional allowed emoji.
- [ ] Export the query DTO at the Nest boundary.

### Task 2: Paginated repository and service reads

**Files:**
- Modify: `apps/api/src/modules/forum/infrastructure/forum-thread.repository.ts`
- Modify: `apps/api/src/modules/forum/infrastructure/forum-post.repository.ts`
- Modify: `apps/api/src/modules/forum/application/forum-thread.service.ts`
- Test: `apps/api/src/modules/forum/application/forum-thread.service.spec.ts`

**Interfaces:**
- Consumes: `{ page, pageSize, emoji? }`.
- Produces: `listThreadReactionUsers(...)` and `listPostReactionUsers(...)` returning `ReactionUsersPage`.

- [ ] Write failing service tests for visibility-first reads, emoji forwarding, pagination metadata, and avatar URL mapping.
- [ ] Run the targeted service test and confirm the missing methods fail.
- [ ] Add repository list/count queries ordered by newest reaction and joined to public user identity.
- [ ] Add service methods that call `requireThread` / `requirePost` before the repository and map storage URLs.
- [ ] Run the targeted service tests to green.

### Task 3: Additive API endpoints and web client

**Files:**
- Modify: `apps/api/src/modules/forum/presentation/forum-thread.controller.ts`
- Modify: `apps/web/src/lib/forum.ts`

**Interfaces:**
- Produces: `GET /v1/forum/threads/:threadId/reactions` and `GET /v1/forum/posts/:postId/reactions` with `page`, `pageSize`, and optional `emoji`.
- Produces: `listReactionUsers(targetType, targetId, query)`.

- [ ] Register typed GET routes without changing existing PUT/DELETE reaction routes.
- [ ] Add the centralized authenticated web wrapper with encoded query parameters.
- [ ] Run targeted API and web type checks.

### Task 4: LinkedIn-style summary and responsive people panel

**Files:**
- Create: `apps/web/src/app/[locale]/(app)/community/_components/reaction-summary.ts`
- Create: `apps/web/src/app/[locale]/(app)/community/_components/ReactionDetailsContent.tsx`
- Modify: `apps/web/src/app/[locale]/(app)/community/_components/reaction-bar.tsx`
- Modify: the three `ReactionBar` call sites for thread/post target identity.
- Modify: `apps/web/messages/tr.json`
- Modify: `apps/web/messages/en.json`
- Test: `apps/web/src/app/[locale]/(app)/community/_components/reaction-summary.spec.ts`

**Interfaces:**
- Consumes: target type/id, counts, viewer selection, existing `onChange` callback.
- Produces: empty `SmilePlus`; otherwise stacked emojis + total count opening the responsive sheet/dialog.

- [ ] Write failing pure tests for zero, mixed counts, and selected reaction summary states.
- [ ] Implement the summary helper and verify tests pass.
- [ ] Build the panel with reaction choices, All/emoji filters, skeleton/error/empty states, and load-more pagination.
- [ ] Replace individual inline chips with the compact reaction summary and wire all call sites.
- [ ] Mirror Turkish/English copy and run targeted tests, lint, and type checks.

### Task 5: Documentation and verification

**Files:**
- Modify: `docs/standards/api.md`
- Modify: `docs/features/forum.md`

- [ ] Add the two endpoints to the service catalog and a concise feature timeline entry.
- [ ] Run forum service tests, web reaction tests, package/API/web type checks, targeted lint, and `git diff --check`.
