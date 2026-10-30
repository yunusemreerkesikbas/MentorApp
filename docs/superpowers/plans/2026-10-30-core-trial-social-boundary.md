# Core-only Trial Social Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. The owner selected implementation in this chat and approved the reviewed scope. Steps use checkbox syntax.

**Goal:** Close social interactions and closed-feature entry points for the approved trial while retaining accounts and personal study/progress.

**Architecture:** A central `community.social.enabled` flag and small shared policy enforce identity/social boundaries; existing feature switches remain independent. A typed public availability response supplies one server-loaded UI snapshot, with explicit unavailable state and server authority on every operation. No schema, provider, role or authentication replacement.

**Tech Stack:** TypeScript, NestJS, central config registry, Next.js App Router, React/next-intl, Vitest and Playwright.

**Spec:** `docs/plans/2026-10-30-core-trial-social-boundary-design.md`.

## Global constraints

- Preserve existing owner changes in the current `feature/APP-123` checkout; no cloud/DNS/billing write, new dependency or provider call.
- Follow the existing API, repository/DI, i18n and design conventions; use existing closed-feature errors/states.
- Flag default preserves current social behavior; trial preparation explicitly sets it false and verifies every independent closure.
- Keep personal summary/profile/achievement collection and solo work usable. Account cleanup bypasses interaction closure.
- Backend decides availability; frontend uses it only for presentation. Unknown availability must not silently enable a feature.
- Run targeted checks after each slice; require complete CI before claiming release readiness.

## Review focus

- Existing relation + direct/stale URL: no cross-user read, mutation or event when social is off.
- Existing room membership + `roomId`: reject before transaction writes while solo and already-running completion remain usable.
- Event queued before closure: no buddy/room delivery and no delivery-deduplication marker while closed.
- Existing coach role with mentorship off: account access remains possible without student-data access or redirect loops.
- Availability fetch failure or stale document: core work remains accessible; closed-feature actions remain guarded on the server.

## Task 1: Social reads, relations and invitation boundary

**Files:** `common/config/config.catalog.ts`, new `common/config/social-access.policy.ts`, `config.module.ts`; identity `follow.service.ts`, `buddy.service.ts`; community `community.service.ts`, `achievement.service.ts`, `buddy-view.service.ts`; economy invite services and matching specs.

**Interfaces:** `SocialAccessPolicy.isEnabled(): Promise<boolean>`, `assertEnabled(): Promise<void>`, `assertSelfOrEnabled(viewerId: string, ownerId: string): Promise<void>`. Denied interaction uses existing localized `NotFoundError`. The policy reads only the central registry.

- [x] RED: explicit false prevents follow/buddy reads, writes and events; internal invitation linking cannot bypass it; unknown users and self access keep their proper behavior.
- [x] Implement the flag (default true), export the policy through the global registry module and call it at the public service boundaries. Preserve cleanup internals.
- [x] RED/GREEN: other-user profile/collection denied, own profile/collection and summary retained. Do not read another module's tables.
- [x] Gate invitation creation/preview/redemption before recorded side effects; preserve existing redemption idempotency and account cleanup.
- [x] Run affected Vitest files, API typecheck and owned-file lint; update ledger.

## Task 2: Passive signals and room participation

**Files:** coaching `session.service.ts`, `study-room.service.ts`; notification identity/invite/buddy/room listeners and their specs.

**Consumes:** Task 1 policy. Existing room flag and existing notification delivery ledger remain authoritative.

- [x] RED: `SessionService.start` with `roomId` and room flag false cannot close stale sessions, touch a room, create a session or emit; solo start still works.
- [x] Check the room switch before opening the room-start transaction. Preserve finalization/history and current membership enforcement when enabled.
- [x] RED/GREEN: disabled buddy/room activity produces no target read/deduplication write/delivery. Keep personal first-session notifications unchanged.
- [x] Guard stale relation/invite event listener paths before user-visible notification side effects.
- [x] Run focused service/listener tests, relevant real HTTP regressions and API checks; update ledger.

## Task 3: Typed availability and shared UI

**Files:** new `packages/types/src/app-availability.ts` plus barrel; new common/config availability service/controller/spec; web availability server loader/context; `[locale]/layout.tsx`; shared app shell/nav, premium entry points, focus rooms/buddy, profile/achievement actions, settings and post-auth destinations.

**Produces:** `GET /v1/app/availability` with only typed non-secret booleans: AI coach, social, forum, study rooms, human coaching, student/coach purchasing, student/coach signup and invitations. Compose purchase/provider conditions in the backend. Existing entitlement checks remain separate.

- [x] RED/GREEN: endpoint returns only allowlisted effective booleans; disabled payment provider and closed channels cannot advertise purchases; no secrets/user state are exposed.
- [x] Load availability on the server alongside root locale messages; pass an explicit nullable snapshot to one context above auth/overlay consumers. Do not add an unmocked browser API call to every existing test.
- [x] Treat unavailable snapshot explicitly and fail closed for feature presentation; retry through document refresh. Server operations remain authoritative if a document becomes stale.
- [x] Hide closed navigation and purchase/AI entry points; preserve design tokens and manual alternatives.
- [x] Handle direct closed URLs and stale invite/post-login destinations calmly. Coach-role accounts retain settings/logout without redirect loops.
- [x] Keep own profile/progress/achievement routes available while hiding social tabs/actions and blocking other-user reads.
- [x] Run relevant web unit tests, typecheck/lint and actual browser regressions in TR/EN at both repository viewports.

## Task 4: Integration, documentation and final review

**Files:** browser API fixture preparation/CI only as needed to seed the ordinary enabled test profile; separate closed-trial browser spec/config; `docs/core/deployment.md`, service catalog and feature timelines.

- [x] Seed ordinary browser fixture flags explicitly in its dedicated test DB, matching the existing enabled-feature mocks; do not add production/dev fail-open behavior for tests.
- [x] Verify the closed profile separately: manual tools, own progress, direct/stale social URLs, known room membership, coach account safety and no closed-provider requests.
- [x] Keep production startup/security/provider requirements; no live configuration changes. Document snapshot refresh and explicit trial flag values.
- [x] Run appropriate broader checks after the cross-cutting changes. Do not represent partial/partitioned evidence as complete CI.
- [x] Dispatch one fresh read-only final reviewer under executing-plans; address blocking findings with RED/GREEN tests.
- [x] Review the final diff/source identity and leave a concrete verified result; no push/merge/deployment without the corresponding release gates.

## Execution rulings / ledger

- Owner approval: the latest “tamam devam edelim” follows the requested joint review and screenshots; proceed with the retained inline method without another permission round.
- Workspace: current named feature branch and existing pending edits are retained; no branch switch/reset or unrelated skill-update staging.
- Availability is a document snapshot, not authorization. Controlled offline registry changes require restart/reload; guards enforce effective server state independently.
- No commit/push is required to make these changes reviewable. Keep the work attributable and defer integration until verification/review, preserving existing mixed pending changes.
