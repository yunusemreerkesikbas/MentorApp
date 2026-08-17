# Forum Tag Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let members suggest missing canonical forum hashtags and let editors approve or reject them into the curated tag pool.

**Architecture:** The forum bounded context owns a `forum_tag_suggestions` table and public member endpoint. Existing admin forum management reviews suggestions; approval creates the tag and resolves the suggestion atomically. Suggestions never attach retroactively to the source question.

**Tech Stack:** NestJS, Drizzle/Postgres, shared Zod/types, Next.js web, Next.js admin/Bootstrap.

## Global Constraints

- Canonical hashtag is lowercase ASCII with hyphens and is derived on the backend.
- One pending suggestion per canonical slug; an existing tag or pending suggestion returns `409`.
- Approval/rejection requires `EDITOR`, is audited, and approval creates an active tag.
- No Playwright; use shared validation, forum unit/integration tests, typecheck and targeted lint.

---

### Task 1: Shared contracts and normalization

**Files:** `packages/validation/src/forum.ts`, `packages/types/src/forum.ts`, forum policy specs.

- [ ] Add failing tests for 2–80 character suggestion input and Turkish-to-ASCII canonical slug behavior.
- [ ] Add `createForumTagSuggestionSchema`, review schema, status/view contracts.
- [ ] Run targeted shared/forum tests green.

### Task 2: Persistence and forum service

**Files:** `apps/api/src/database/schema.ts`, generated Drizzle migration, discovery repository/service specs and implementations.

- [ ] Add failing service/repository-facing tests for create, duplicate, approve and reject.
- [ ] Add suggestion table, indexes and repository methods.
- [ ] Implement member creation plus transactional admin resolution.
- [ ] Add localized conflict/not-found error codes.

### Task 3: Public and admin API

**Files:** forum DTO/controller, admin DTO/controller, API catalog/OpenAPI artifacts.

- [ ] Add member `POST /v1/forum/tag-suggestions`.
- [ ] Add admin list and review endpoints under `/v1/admin/forum/tag-suggestions`.
- [ ] Extend admin audit action/target constants and regenerate API artifacts where applicable.

### Task 4: Web and admin experiences

**Files:** Q/A question composer, forum web client, admin forum page, TR/EN messages.

- [ ] Show an inline empty-result action that submits the current query as a suggestion.
- [ ] Render pending/success/error states without adding the pending tag to the question.
- [ ] Add an admin suggestion queue with approve/reject actions and localized names editable before approval.

### Task 5: Documentation and verification

**Files:** `docs/features/forum.md`, `docs/standards/api.md`.

- [ ] Document usage, moderation, canonical slug and non-retroactive behavior.
- [ ] Run targeted tests, package typechecks, touched-file lint, migration consistency and relevant builds.
