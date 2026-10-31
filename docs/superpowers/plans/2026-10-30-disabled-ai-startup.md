# Disabled AI Startup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The owner selected inline execution. Steps use checkbox syntax for tracking.

**Goal:** Start the core-only trial without OpenAI/Gemini credentials while keeping all AI operations closed.

**Architecture:** Add paired disabled provider values, select a rejecting adapter through existing ports,
and force the central effective AI flag off in this deployment. Real providers retain key validation.

**Tech Stack:** Existing TypeScript, NestJS, Zod, Vitest and pg/Drizzle. No dependency or migration.

**Spec:** `docs/plans/2026-10-30-disabled-ai-startup-design.md`

## Global Constraints

- `AI_PROVIDER=disabled` and `VISION_PROVIDER=disabled` are selected together.
- Production fake-provider restrictions and all non-AI security/provider checks remain enforced.
- All denied AI operations use the existing `AI_DISABLED` 404; no fake fallback or provider request.
- Preserve the original checkout/index and existing owner changes; no worktree or branch switch.
- Do not upload credentials, deploy, merge, alter DNS or apply the paid Blueprint during implementation.

## Review Focus

- A stored/default `ai.enabled=true` must not reopen disabled AI or advertise it as available.
- A partially disabled provider pair and unrecognized provider values must fail startup.
- Streaming must fail when consumed, without yielding output or contacting a provider.
- Attempting to enable AI must not persist an override or emit a misleading change event.
- Selecting real providers again must still reject missing keys; unrelated production locks survive.

### Task 1: Credential-free provider selection

**Files:** Modify `apps/api/src/config/env.validation.ts`, `apps/api/src/modules/ai/ai.module.ts`.
Create `apps/api/src/modules/ai/infrastructure/adapters/disabled-ai.adapter.ts`.
Tests: existing `env.validation.spec.ts`, new `env-disabled-ai.spec.ts`, `disabled-ai.adapter.spec.ts` and
`apps/api/src/modules/ai/ai-provider-selection.spec.ts`.

**Interfaces:** Existing `LlmPort`/`VisionPort`; add paired `disabled` enum values and
`DisabledAiAdapter` implementing complete, completeStream, embed and categorizeImage.

- [x] Add RED tests: production accepts both disabled without either key; rejects mixed disabled
  pairs/unknown values; real selections still reject missing keys and fake remains forbidden.
  Every disabled operation must reject `{code: 'AI_DISABLED', httpStatus: 404}` with no output.
  A reduced Nest test resolves the actual module provider definitions for disabled and real modes.
- [x] Run the new/affected tests using the existing unit runner and verify the expected missing
  behavior before implementing. Command from `apps/api`:
  `node node_modules/vitest/vitest.mjs run --config vitest.unit.config.ts src/config/env.validation.spec.ts src/config/env-disabled-ai.spec.ts src/modules/ai/infrastructure/adapters/disabled-ai.adapter.spec.ts src/modules/ai/ai-provider-selection.spec.ts`.
- [x] Add the enum/pair validation, rejecting adapter and explicit Nest selections. Keep real
  key checks and defaults. Re-run the command. Expected: all task tests pass.
- [x] Record RED/GREEN evidence and the task result in this plan's ledger. Preserve the checkout;
  create a scoped candidate commit only after final review, rather than staging the dirty workspace.

### Task 2: Authoritative effective AI closure

**Files:** Modify `apps/api/src/common/config/config-registry.service.ts` and its spec.
Create `apps/api/test/disabled-ai-startup.e2e-spec.ts` using the existing guarded local harness.
The implementation also adds `test/database-target.ts` and its unit spec, guards
`test/global-setup.ts` before connection, and pins the development ad flag false in both
Vitest configurations. These test-isolation corrections are explained in the ledger.

**Interfaces:** `ConfigRegistryService.get/list/set` retain their signatures; `ai.enabled` is
effectively false in disabled mode, and set-to-true rejects `ADMIN_CONFIG_INVALID_VALUE`.

- [x] Add RED tests for default/stored-true overrides, read/list agreement, rejected enable with
  no upsert/event, allowed false/unrelated edits and unchanged real-provider behavior.
- [x] Run the registry unit suite; expected RED for disabled-mode cases. Implement the central
  effective-value rule and write guard; re-run. Command from `apps/api`:
  `node node_modules/vitest/vitest.mjs run --config vitest.unit.config.ts src/common/config/config-registry.service.spec.ts src/common/config/app-availability.service.spec.ts src/modules/ai/infrastructure/adapters/ai-provider-kill-switch.spec.ts`.
  Expected: registry and adjacent boundary suites pass.
- [x] Add an isolated HTTP/Postgres smoke using explicit disabled providers and absent AI keys.
  Verify app startup, `aiCoach=false`, refused direct AI operations and normal own-account access.
  Snapshot/restore exact touched config rows and environment in failure-safe teardown. Do not
  weaken the global destructive-test loopback guard or production locks.
- [x] Set `TEST_DATABASE_URL` privately to a fresh loopback database named `mentor_disabled_ai_test`.
  From `apps/api`, run `node node_modules/vitest/vitest.mjs run test/disabled-ai-startup.e2e-spec.ts test/core-trial-social-boundary.e2e-spec.ts`.
  Expected: pass with no provider network call. Record the command, isolation and result.
  The local HTTP smoke uses test environment/storage, while Task 1 independently validates
  production startup settings; neither is a hosted production acceptance claim.

### Task 3: Trial configuration, review and release candidate

**Files:** `.env.example`, `docs/core/deployment.md`, `docs/features/{ai,deployment}.md`,
the current hosting QA record and a new verification record. Local ignored runtime settings only.

**Interfaces:** Trial selects both disabled provider values and omits AI credentials. Real-provider
activation keeps its existing budget, provider, consent and acceptance prerequisites.

- [x] Update docs and local trial runtime settings. Explicitly distinguish immutable provider
  closure from the runtime DB kill-switch. Do not modify the optional paid Blueprint profile.
- [x] Run affected API suites, API typecheck/build and lint on touched files. Expected: pass;
  preserve and explain existing unrelated warnings rather than suppress them.
- [x] Request one fresh read-only review of this change against the spec and Review Focus.
  Address concrete important findings with reproduced RED/GREEN tests; record rulings.
- [x] Form a scoped commit on the existing release-candidate branch with a temporary index,
  preserving the owner's branch/index/working files. Verify the candidate source and secret scan.
  Push the candidate branch (no force/merge) and require full CI on the resulting exact SHA
  before hosted acceptance. Do not reuse the old successful CI as evidence for the new code.

## Self-review

Spec requirements map to Tasks 1–3. Public availability consumes the registry, so no duplicate
frontend condition or API contract is added. The plan preserves real-provider validation and
no-op-free denial behavior. New config/HTTP fixtures must not alter another test's global flags.
Owner approved the plan and inline implementation in this chat on 2026-10-30.

Completion evidence: candidate `1513a5bb12d30d557d415a6991d65224f5a7e9c2`,
[full CI 41131102949](https://github.com/yunusemreerkesikbas/MentorApp/actions/runs/41131102949)
passed. See [verification](../../qa/2026-10-31-disabled-ai-startup-verification.md).
