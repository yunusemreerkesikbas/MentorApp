# Bounded Trial Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Preserve the owner's inline execution preference. Steps use checkbox syntax for tracking.

**Goal:** Bound the selected trial's total R2 storage/operations while retaining photos and usable core study tools.

**Architecture:** Guard the existing raw storage port with durable Postgres reservations and serve media through the single NestJS API. Private read grants bind an object to the authenticated owner/session. Separate the media HTTP module from storage accounting to consume Identity's public session validator without a circular service dependency.

**Tech Stack:** Existing TypeScript, NestJS, Zod, Drizzle/pg/RLS, AWS S3 SDK, Next.js, Vitest and Playwright. No new service or dependency.

**Spec:** `docs/plans/2026-10-31-bounded-trial-storage-design.md`

## Global Constraints

- New trial profile uses `STORAGE_ACCESS_MODE=bounded`; legacy `direct` is retained explicitly for existing non-trial configurations. A sealed trial DB refuses a direct-mode rollback or changed bucket scope.
- Global initial limits: **524288000 bytes**, **10000 Class A**, **100000 Class B**, across all roles/users. No zero/unlimited value, time reset, process-local counter or automatic refill.
- Owner-approved 2026-10-31 addendum: **1073741824 media payload transfer bytes** for the whole trial. Charge PUT payloads and each full manifest-sized read before provider access; never refund used/uncertain transfer on deletion. Copy/list/delete/initialization carry no object body through the API. This is not a cap on HTTP headers, application pages, database traffic or the whole Render workspace.
- Existing 5-photo Free entitlement, signatures, per-user tickets/limits and ownership checks remain. All prefixes use the same aggregate guard; closed features stay closed.
- Confirmed deletion remains available after exhaustion. No automatic photo deletion, lost notebook references, premium bypass or upgrade demand.
- All new trial buckets are EU/private at the provider boundary, including logically public content. No raw R2 browser URL in bounded mode; require `R2_JURISDICTION=eu` for this profile.
- Preserve the original checkout/index and owner changes. Candidate base is `1513a5bb12d30d557d415a6991d65224f5a7e9c2`; finish its pending CI before modifying its verified source. Use a temporary index for the next reviewed candidate, no checkout/reset/force push/merge.
- No extra staging setup, staging pipeline or staging-specific code. Use one selected Free trial environment for later synthetic acceptance before admission.
- No remote migration, bucket/token/DNS/billing change, credential upload or provider call during source implementation. No paid service, Worker, Redis or scheduler.
- A Puhu usage bound is not a zero account invoice guarantee for unrelated workloads. Preserve existing dev/staging/Craftive resources.

## Review Focus

- A restart, direct-mode selection or bucket rename must not discard existing usage or expose an unmetered fallback.
- A process that disappears after a provider success, or a late PUT finishing after cleanup, must not free bytes or repeat an operation under its old reservation.
- Private grants must use the actual HTTP session, not any active session for the owner; expired/revoked grants fail before R2.
- A media refusal must preserve notebook/board data and prevent incomplete exports, including stale in-flight UI work.
- HTTP HEAD, malformed paths, SDK retries and raw-port callers must not bypass the read bound or private/public split.

## File map

Keep each new service/repository below the repository's 250–300 line target.

- `apps/api/src/database/schema-storage-budget.ts`: singleton scope/counters, object manifest and operation reservations; export from `schema-all.ts`, generate the next migration/meta with Drizzle.
- `apps/api/src/shared/storage/storage-budget.types.ts`, `storage-budget.repository.ts`, `storage-budget.service.ts`: typed operations, atomic reservations and settlement.
- `apps/api/src/shared/storage/bounded-storage.adapter.ts`: guarded ObjectStoragePort decorator; `storage.module.ts` selects it. `shared/adapters/storage/r2-storage.adapter.ts` pins bounded-mode wire attempts and denies direct URL generation.
- `apps/api/src/shared/storage/media-read-grant.service.ts`: purpose-specific HMAC grants and gateway URL construction; no provider/network work.
- `apps/api/src/shared/storage/media-gateway.module.ts`, `media.controller.ts`, `media-read.service.ts`: public/private HTTP boundary. Import IdentityModule here for TokenService; import the gateway once in AppModule. StorageModule exports grant/accounting services and the guarded raw port, without importing IdentityModule.
- Coaching DTO hydration carries an optional `StorageReadActor` from authenticated controllers. Extract photo DTO work into `modules/coaching/application/notebook-entry-view.service.ts`; update `vision.service.ts`, notebook service/controllers and their tests. Backend evidence reads without an HTTP actor return data without private URLs.
- Web: shared `components/media-image.tsx`, notebook card/lightbox/page image renderers, vision-board image renderers and `components/vision-board/board-export.ts`; mirrored messages and dedicated browser checks.
- Configuration/errors/i18n/env example, `scripts/initialize-trial-storage-budget.ts`, storage/deployment/API docs and feature timelines complete the integration. No edits to applied migrations.

### Task 1: Durable scope, limits and reservation accounting

**Interfaces:**

`StorageReadActor = { userId: string; sessionId: string }`.
`StorageUsageLimits = { storedBytes: number; classA: number; classB: number }`.
`StorageOperation` is a discriminated union: put `{key,bytes,contentType}`, copy `{sourceKey,key}`, read `{key,maxBytes?}`, list `{prefix,limit}`, delete `{key}`.
`StorageBudgetRepository.reserve(operation, limits): Promise<StorageReservation>` returns a unique `{id,kind,key?,reservedBytes,classA,classB}`. `settle(id, outcome: 'succeeded' | 'uncertain'): Promise<void>` is idempotent; operation usage never refunds. `manifest(key: string): Promise<StorageObjectRecord | undefined>` returns `{key,bytes,contentType,state: 'confirmed' | 'uncertain' | 'deleting'}` or absence.

- [ ] Add RED unit and loopback PostgreSQL tests in `storage-budget.service.spec.ts` and `test/storage-budget.e2e-spec.ts`. Representative assertion:
  With the singleton one operation below its limit, `expect((await Promise.allSettled([repository.reserve(firstPut, limits), repository.reserve(secondPut, limits)])).filter(x => x.status === 'fulfilled')).toHaveLength(1)`.
  Cover 524288000/10000/100000 exact boundaries, every role, SERVICE-only RLS, two connections, restart persistence, uncertain writes and idempotent confirmed deletion. A DELETE acknowledgement must not automatically release a pending/uncertain PUT reservation: simulate the PUT completing late after that DELETE and assert the bytes remain charged. Uncertain reservations require quiescent operator reconciliation with recorded facts, not automatic refunds.
- [ ] Run from `apps/api`: `node node_modules/vitest/vitest.mjs run --config vitest.unit.config.ts src/shared/storage/storage-budget.service.spec.ts`; then the new HTTP-runner repository spec with explicit loopback `_test` DATABASE_URL. Expected RED before the new implementation. Never connect a hosted database.
- [ ] Add three storage-owned tables: fixed singleton ID, pinned account/bucket/jurisdiction fingerprint and readiness state; manifest keyed by object key; append-only reservation facts/settlement. Transaction-lock the singleton before checking limits. Bind scope once, not from a caller-controlled reset key. An absent/unready/changed scope refuses normal operations.
- [ ] Add positive bounded registry keys `storage.budget.max_stored_bytes=524288000`, `storage.budget.max_class_a=10000`, `storage.budget.max_class_b=100000`, each with minimum 1 and maximum equal to its approved initial value. Raising those ceilings requires a reviewed change. Resolve validated limits before the transaction. Config edits never reset usage. Add localized `STORAGE_TEMPORARILY_UNAVAILABLE` (503) without account-usage details.
- [ ] Generate the next migration via `pnpm --filter @mentor/api db:generate`; inspect generated RLS/checks/indexes and untouched prior migration hashes. Re-run both tests. Expected GREEN, no provider call. Record evidence and scoped task result; defer candidate commit until final review as in the prior approved checkout workflow.

### Task 2: Guard every raw operation and initialize without guessing

**Interfaces:** `BoundedStorageAdapter implements ObjectStoragePort`, wrapping the existing adapter and Task-1 repository/service. `StorageBudgetService.run<T>(operation, invoke: () => Promise<T>): Promise<T>` reserves before invocation and settles conservatively. `assertScope(mode, fingerprint)` refuses a direct-mode or changed-scope deployment against a READY bounded DB.
For the operator script, `beginInitialization(scope: StorageScope): Promise<{id: string; probeReservations: [StorageReservation, StorageReservation]}>` binds `{accountId, publicBucket, privateBucket, jurisdiction: 'eu'}` and reserves two bounded list attempts; `markReady(initializationId: string): Promise<void>` finalizes only the same verified initialization. These methods are not exposed over HTTP.

- [ ] Add RED `bounded-storage.adapter.spec.ts` and extend real SDK adapter tests: denial invokes no raw method; read with maxBytes reserves two Class B attempts (HEAD+GET), ordinary read one, put/copy/list one Class A, delete zero paid operations. Unknown keys and bytes fail before SDK calls. Bound retries explicitly with `maxAttempts: 1`; test an SDK transport failure cannot make a hidden second request.
  Named regression: `it('refuses before raw access when the global budget is full', ...)` asserts `await expect(adapter.readObject(key, 5242880)).rejects.toMatchObject({code: 'STORAGE_TEMPORARILY_UNAVAILABLE'})` and `expect(raw.readObject).not.toHaveBeenCalled()`.
- [ ] Run the new/adjacent unit suites. Expected RED on unguarded calls. Implement the decorator/factory and explicit S3 attempt policy in bounded mode, including `followRegionRedirects: false`. Stub transient, redirect and clock-skew responses to verify at most one wire attempt. Keep used attempts charged on failure/null/timeout; keep pending/uncertain write bytes reserved even after cleanup acknowledges a deletion. Copies require a known confirmed source size; no implicit zero-size inventory. Delete releases only confirmed-settled object capacity after provider acknowledgement. Do not turn budget refusal into an empty list or missing object.
- [ ] Add process-level `STORAGE_ACCESS_MODE` enum (default direct for compatibility), trial bounded scope checks, and startup/config tests. Bounded mode cannot call raw `createReadUrl` or return a provider public URL. Both gateway and backend/cleanup callers receive the guarded raw port.
- [ ] Implement a trusted operator-only initialization script with no public endpoint. It verifies the exact fixed database and new bucket scope, reserves its two list probes in the singleton before network work, uses maxKeys=1 and no SDK retries, and sets READY only when both buckets are confirmed empty. Nonempty/ambiguous results stay blocked and retain probe usage. Repeats require a new explicit operator run; never reset existing usage. The script does not provision, delete or change access settings.
- [ ] Re-run unit/real-SDK no-network tests plus the local repository suite. Expected GREEN, including direct-mode rollback rejection against a sealed row and stable fingerprints across restarts. Record RED/GREEN. Live initialization remains separately gated after exact-commit CI and provider setup approval.

### Task 3: Media gateway and owner/session-bound grants

**Interfaces:** `MediaReadGrantService.issue(key, actor, ttlSeconds): string`; `verify(token): {key,userId,sessionId,expiresAt}`. `MediaReadService.readPublic(key)` and `readPrivate(token)` return `{bytes:Buffer,contentType:string}` through the guarded port. GET `/v1/storage/media/public/*key` and `/v1/storage/media/private?grant=...` are the only bounded media read paths. No redirect to R2.

- [ ] Add RED `media-read-grant.service.spec.ts`, `media-read.service.spec.ts` and local `test/bounded-media.e2e-spec.ts`: tampered/expired grants, wrong owner, revoked actual session while another session stays active, unknown prefix/key, path traversal/encoding, HEAD/unsupported methods, exhausted allowance and concurrent reads.
  Named regression: `it('refuses a grant from a revoked session while the owner has another live session', ...)` asserts the private GET is unauthorized and `expect(raw.readObject).not.toHaveBeenCalled()`.
- [ ] Pin independent `MEDIA_READ_SECRET` (32+ characters) for bounded mode; never reuse auth/edge/cron keys. Pin a test-only value in both test runners and bounded browser fixtures. Add `storage.media.read_seconds=300` with allowed range 30–300. HMAC a versioned allowlisted payload; constant-time signature comparison and Zod validation precede use. In bounded mode `R2_PUBLIC_BASE_URL` must be an explicit HTTPS URL ending in `/v1/storage/media/public`, without credentials/query/fragment; private grants use the same origin at `/v1/storage/media/private?grant=...`. This API origin is finalized from the actual selected service/domain, not a guessed hostname.
- [ ] Implement the separate media HTTP module consuming Identity's exported `TokenService.validateSession(sessionId,userId)` before private provider access. Prefix and manifest checks precede any provider call. Public paths accept only PUBLIC_PREFIXES. Private responses use no-store/no-referrer, explicit MIME/nosniff and no shared cache; public responses remain conservatively no-store for this first trial. HEAD validates access without a body/provider read. No arbitrary remote fetch, raw provider error or global usage disclosure.
- [ ] Extend request/Sentry redaction tests for grants on matched and unmatched paths/query values. Run the unit runner plus local bounded-media E2E (loopback `_test`, actual Nest boundary and stubbed transport). Expected RED before implementation and GREEN afterward; real S3 credentials/network are absent.

### Task 4: Carry the actual actor without breaking core DTO reads

**Interfaces:** `StoragePort.getPrivateUrl(key, actor: StorageReadActor): Promise<string>` issues a gateway grant without R2 access. `getPublicUrl(key): string` remains synchronous. Coaching DTO reads receive an optional final `readActor?: StorageReadActor`; only authenticated HTTP paths supply it. Without one, omit private URL values while retaining keys/data for backend evidence.

- [ ] Add RED focused coaching tests: the HTTP actor's exact session reaches each generated grant; data-only evidence/mutations issue no private grant; expired/exhausted media does not reject a whole notebook/board data response. Keep all DTO fields and existing Free limits. Assert all notebook read/mutation routes returning image DTOs carry actor context, including page/due/review responses.
  Named regression: `it('uses the current HTTP session for every notebook photo', ...)` asserts `expect(storage.getPrivateUrl).toHaveBeenCalledWith(photoKey, {userId, sessionId})`; the data-only case asserts no grant call and preserved entry ID/note/key.
- [ ] Extract notebook photo DTO hydration into `notebook-entry-view.service.ts`, retaining batched taxonomy resolution and parallel independent URL creation. Thread actor through only the existing controller/service projection paths. Apply the same optional projection to vision get/upsert/putBoard; AI evidence paths receive data without private URLs. No global async request context or fabricated/any-active session.
- [ ] Make SecureStorageService select gateway URL/grant behavior only in bounded mode; preserve explicit legacy direct configurations. Ensure no bounded caller can mint an S3 URL through RAW_STORAGE_PORT. Add actual Nest factory selection tests, not only manually constructed wrappers.
- [ ] Run the focused coaching/storage/identity session suites and typecheck the API/shared types. Expected GREEN, including actual local HTTP photo URLs and independent core account/text access. Record evidence and update the service catalog if signatures/exported services change.

### Task 5: Media failure UI and complete exports

**Interfaces:** reusable `MediaImage` renders existing URL/alt/layout plus localized temporary failure; no usage calculation in FE. `BoardExportMediaUnavailableError` prevents an export that requires an unavailable photo. API URLs/grants remain opaque to business/UI logic.

- [ ] Add RED `e2e/bounded-media.spec.ts` for card, page/lightbox, vision board, public avatar/content fallback, retry, logout/session revocation and intact text/plan/session actions. Add a board-export regression: one failed required photo rejects export instead of producing a placeholder-filled file, while preserving the editor document. Include an in-flight stale image finishing after logout/unmount.
  Named export regression: `it('refuses an export with an unavailable required photo', ...)` asserts `await expect(renderBoardToBlob(doc)).rejects.toBeInstanceOf(BoardExportMediaUnavailableError)` and `expect(doc).toEqual(savedDocument)`.
- [ ] Implement the focused image fallback/component and export error handling with DESIGN tokens and mirrored TR/EN keys. Keep private URLs unoptimized/no-store; no global object-URL/capability cache across users. Do not add upgrade prompts or delete photo references. Existing blob previews remain usable before reload.
- [ ] Run relevant web unit tests and the dedicated browser spec on the owned local fixture; add the dedicated spec to existing CI coverage without creating a staging workflow. Expected GREEN. API-origin CORS/CSP and authenticated-origin checks remain explicit and strict.

### Task 6: Final source verification, documentation and next candidate

**Interfaces:** approved profile, schema, guarded raw port, gateway URLs and server error code from Tasks 1–5. One next reviewed candidate based on 1513a5bb, preserving the owner's checkout/index.

- [ ] Implement the owner's approved 1 GiB transfer addendum with RED/GREEN registry, concurrent PostgreSQL and HTTP tests. Add nullable historical transfer counters/facts via the next forward migration; initialize only a provably untouched state at zero. Unknown historical usage fails closed. Extend typed limits/reservations, charge PUT/read object bytes under the existing singleton lock and retain charges after errors/deletions/restarts. Keep ordinary read attempt counts and gateway HEAD behavior unchanged. Re-run accounting/provider/HTTP suites.

- [ ] Update `.env.example`, core storage/deployment docs, matching feature timelines and API/OpenAPI generated contracts only where needed. Record bounded mode, exact limits, independent signing secret, private bucket requirements, initialization, no refill and compatible rollback. Document new migration/operator boundaries and no extra staging. No new provider credential is uploaded.
- [ ] Run affected units/local Postgres/HTTP/browser checks, targeted lint/typecheck/build and link/diff checks. Check all raw adapter call sites, all image URL consumers, new RLS roles and retained prior migration hashes. Expected GREEN; preserve unrelated owner edits and explain existing warnings.
- [ ] Request one fresh read-only final review of this scoped source/spec/ledger and Review Focus. Important findings get reproduced RED/GREEN fixes; record decisions and minors. Do not reuse the disabled-AI review as storage approval.
- [ ] Form a scoped reviewed commit using a temporary index, verify the entire executable source against the candidate, run the new-range secret scan, fast-forward push the existing candidate branch and require full CI on that exact SHA. No merge/force push/deploy.
- [ ] Produce the concrete single-Free-environment acceptance package: private EU bucket/token permissions, exact origins, initialization probes and total finite provider request/byte budget, independent signing key destination, stop/rollback procedure. Obtain any required action-time confirmation before secret transmission/access changes and final publication approval after acceptance. These live actions are not part of source implementation authorization.

## Verification commands

Run these from `apps/api` unless noted. For every database run set `TEST_DATABASE_URL`
privately to fresh loopback `mentor_storage_budget_test`; reuse the existing global target
guard before connecting. Each fixture restores its exact singleton/config state and only
its own synthetic rows. Test RLS through the existing restricted-role harness, not a
superuser/owner connection. All SDK/HTTP transport is stubbed.

| Task | RED then GREEN gate | Expected final result |
| --- | --- | --- |
| 1 | `node node_modules/vitest/vitest.mjs run --config vitest.unit.config.ts src/shared/storage/storage-budget.service.spec.ts` and `node node_modules/vitest/vitest.mjs run test/storage-budget.e2e-spec.ts` | Atomic limits, conservative settlement and restricted-role RLS pass |
| 2 | `node node_modules/vitest/vitest.mjs run --config vitest.unit.config.ts src/shared/storage/bounded-storage.adapter.spec.ts src/shared/adapters/storage` plus Task-1 DB gate | Every raw path bounded; real SDK stub sees at most reserved attempts |
| 3 | `node node_modules/vitest/vitest.mjs run --config vitest.unit.config.ts src/shared/storage/media-read-grant.service.spec.ts src/shared/storage/media-read.service.spec.ts src/observability` and `node node_modules/vitest/vitest.mjs run test/bounded-media.e2e-spec.ts` | Auth/session, method, budget, privacy and URL gates pass |
| 4 | `node node_modules/vitest/vitest.mjs run --config vitest.unit.config.ts src/modules/coaching/application/mistake-notebook.service.spec.ts src/modules/coaching/application/vision.service.spec.ts src/modules/coaching/presentation/media-actor.controller.spec.ts src/shared/storage/secure-storage.service.spec.ts` plus Task-3 HTTP gate | Correct HTTP actor and intact data-only projections |
| 5 | Web: `node node_modules/vitest/vitest.mjs run src/components/vision-board/board-export.spec.ts`; `node node_modules/@playwright/test/cli.js test --config=playwright.bounded-media.config.ts` with the explicit isolated loopback database/API fixture | Complete export or explicit refusal; working core UI |
| 6 | Affected gates above, API/web/shared package typechecks/builds and touched-file lint; then full CI on the next exact candidate SHA | No targeted-only release claim; no provider/staging side effect |

## Self-review and handoff

Spec sections 1–2 map to Tasks 1–2, read/session boundaries to Tasks 3–4, user behavior and verification to Tasks 5–6. All five Review Focus inputs have owning regressions. SDK wire bounds and an empty verified bucket scope are prerequisites, not assumptions. The fixed singleton prevents a renamed deployment from resetting usage; retained uncertainty prevents crash refunds. Data-only evidence avoids issuing another user's media capability. No new staging or paid infrastructure is introduced.

The owner approved the design, reviewed this written plan and authorized inline implementation in chat on 2026-10-31. The disabled-AI candidate's full CI passed before storage source edits begin and does not certify the future storage implementation.

SDK reference: [AWS retry settings and explicit client precedence](https://docs.aws.amazon.com/sdkref/latest/guide/feature-retry-behavior.html).
The implementation must also verify the installed S3 client's real transport behavior; no new retry-mode opt-in is introduced.
