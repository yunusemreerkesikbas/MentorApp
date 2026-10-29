# AI Provider Kill-switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Prevent every call through the application's text, streaming, embedding and vision ports when the global AI flag is off.

**Architecture:** Inject the existing ConfigRegistryService at the two decorated provider adapters. Check the existing `ai.enabled` flag immediately before acquiring budget or calling a raw provider, including on every embedding call. Keep existing privacy minimization and budget lifecycles intact; do not add a new port, wrapper or provider.

**Tech Stack:** TypeScript, NestJS DI, existing Vitest. No live provider calls, dependencies or migrations.

**Spec:** [launch review finding 3](../../qa/2026-10-29-launch-readiness-review.md)
and [selected trial design](../../plans/2026-10-29-admin-closed-pilot-design.md).

## Global constraints

- Use existing `AI_DISABLED` with HTTP 404, matching current feature-service behavior.
- Preserve raw/editorial embedding text behavior and complete/history privacy minimization.
- Preserve complete/stream/vision reservation acquisition, handoff and failure release.
- Do not change shared catalog defaults or concurrent notebook entitlement/quota code.
- No real key reads, API requests, telemetry, jobs or live flag writes for validation.
- AI-off denial closes this trial gate; embedding cost accounting while AI is enabled
  remains a separate unresolved activation gate and must be disclosed.

## Review focus

1. An already queued embedding job must not reach the provider after AI is switched off.
2. Async generators execute on iteration: consume the stream before asserting denial.
3. Reusing an adapter after a flag change must not cache an earlier true value.
4. Disabled AI must not reserve budget or mutate usage as if a provider ran.
5. Vision and text must use the same effective registry decision without bypassing privacy.

### Task 1: Close both existing provider boundaries

**Files:** API `src/modules/ai/infrastructure/adapters/privacy-preserving-llm.adapter.ts`,
`privacy-preserving-llm.adapter.spec.ts`, `budgeted-vision.adapter.ts`,
`budgeted-vision.adapter.spec.ts`; create `ai-provider-kill-switch.spec.ts` alongside them
for shared-boundary regressions. Update every direct constructor call in these tests.

**Interfaces:** Keep `LlmPort` and `VisionPort` unchanged. Append required
`ConfigRegistryService` DI to each concrete adapter constructor, without optional
fallbacks. Existing AiModule providers resolve the already-global registry; verify
that wiring rather than adding a duplicate registry/provider.

- [x] Write failing tests asserting `{ code: "AI_DISABLED", httpStatus: 404 }` for
  complete, consumed completeStream, embed and categorizeImage when `ai.enabled=false`.
  Provider spies, budget.acquire and budget.release must remain uncalled.
- [x] In a single adapter instance, change the registry fixture from true to false
  between calls; the second call must be denied. Include a queued embedding handler
  invoking the real decorated LLM port with stub content/provider and assert zero
  provider calls and zero `setArticleEmbedding` writes.
- [x] Run `pnpm --filter @mentor/api test:unit src/modules/ai/infrastructure/adapters/ai-provider-kill-switch.spec.ts`
  and require the expected missing-gate failures. Adjust only test setup errors first.
- [x] Add a small private assertion in the text adapter and a direct assertion in the
  single vision operation. Read `ai.enabled` per operation; deny before budget/provider.
  For streaming, perform the check when iteration begins. Make embed async if needed
  without changing the Promise<number[]> port contract.
- [x] Supply an explicit true config fixture to all existing direct-constructor tests.
  Keep assertions proving prompt privacy, editorial pass-through, reservation handoff,
  stream cancellation and failure release; add missing meaningful lifecycle coverage.
- [x] Run kill-switch, privacy adapter, vision adapter, existing budget and article
  listener suites through `test:unit`; require all selected tests to pass.

### Task 2: Accurate operational handoff

**Files:** `docs/features/ai.md`, `docs/features/deployment.md`, the launch review and
trial design. No schema, OpenAPI endpoint or generated client changes.

- [x] Record RED/GREEN evidence and targeted test counts. Describe operation-level
  denial, existing queue retry consequences and no mid-flight cancellation promise.
  A call already sent before disabling cannot be undone by the flag.
- [x] Preserve the positive 100-cent trial cap preparation and explicit `ai.enabled=false`
  release requirement. Do not claim the app cap accounts for enabled embeddings or
  guarantees a provider invoice ceiling.
- [x] Run API typecheck and ESLint on owned files; inspect all RAW_LLM_PORT/RAW_VISION_PORT
  consumers for a bypass outside the decorated ports. Broaden validation if one exists.
- [x] Review owned changes after checks, preserving the dirty tree; commit deferred.
  No live activation, push, merge, deployment or credential upload.

## Exit criteria

All four operations are denied at the actual shared adapter boundary with AI off and
existing enabled behavior remains covered. This is local source verification only.
Provider/model/pricing/accounting acceptance and final full CI remain open before AI
activation or publication.


## Execution result

Local implementation and targeted checks complete; independent scoped review found no
blocking issue. Commit steps are explicitly deferred in the shared dirty checkout.
No live flag/provider change, full CI, merge, push or release was performed.
Evidence: [implementation record](../../qa/2026-10-29-closed-trial-implementation.md).

