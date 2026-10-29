# Closed-admin Trial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Let the production API run in an explicit mode that rejects all admin operations without requiring Access enrollment.

**Architecture:** Add `ADMIN_ACCESS_MODE=cloudflare|disabled`, defaulting to `cloudflare`. Reuse the global CloudflareAccessGuard to deny admin API/auth routes in disabled mode; only Access issuer/audience requirements become conditional. All other security and module wiring stays intact.

**Tech Stack:** TypeScript, NestJS, Zod, existing Vitest/Supertest. No dependencies or migrations.

**Spec:** [selected design](../../plans/2026-10-29-admin-closed-pilot-design.md).

## Global constraints

- Core-only trial: planning, sessions, analysis, notebooks and account flows; forum and human coaching closed.
- Production remains `NODE_ENV=production`; no fake credentials/providers or Access bypass mode.
- Preserve the dirty original checkout and the owner's notebook/platform edits. No blanket staging or commits.
- Do not apply the paid `render.yaml`, publish admin, alter DNS, upload secrets or activate a scheduler.
- Environment configuration is separate from persisted feature flags. Public signup remains the recorded direction.
- Scope is the boundary below; AI kill-switch work has a separate independently testable plan.

## Review focus

1. A stale privileged token or valid Access assertion must not override disabled mode.
2. Admin auth is public to JWT but must still be denied before login/refresh/logout mutations.
3. Admin reembedding belongs to AiModule and must not escape prefix coverage.
4. Invalid/absent mode must not accidentally open admin; cloudflare remains the default.
5. Removing Access requirements must not weaken origin, role, provider, mail or Turnstile requirements.

### Task 1: Environment contract and guard denial

**Files:** Modify API `src/config/env.validation.ts`, `src/config/env-production-locks.ts`,
`src/common/auth/cloudflare-access.guard.ts` and `cloudflare-access.guard.spec.ts`.
Create `src/config/env-admin-access.spec.ts` to keep the existing env suite manageable.

**Interfaces:** `Env.ADMIN_ACCESS_MODE: "cloudflare" | "disabled"`; the production-security
input receives this field. `CloudflareAccessGuard.canActivate(context)` retains its signature.

- [x] Write failing validation tests: default is `cloudflare`; empty/unknown mode rejects;
  valid production `disabled` fixture accepts absent Access issuer/audience; default and
  explicit cloudflare fixtures reject them. Use synthetic values only.
- [x] Add a parameterized disabled-fixture test that still rejects each missing edge,
  Turnstile, Resend, real provider key and required security origin. Keep production DB
  role validation separately covered by the existing runtime-role tests.
- [x] Add failing guard tests covering admin config/users/content/AI plus admin auth
  login/refresh/logout, with and without a valid-looking assertion/privileged user.
  Expect a localized-domain `FORBIDDEN`, HTTP 403, zero verifier/identity calls and no
  `cloudflareAccessEmail` assignment. Cover query strings, case/trailing slash, both
  versioned and unversioned paths; neighboring non-admin paths must pass.
- [x] Run `pnpm --filter @mentor/api test:unit src/config/env-admin-access.spec.ts src/common/auth/cloudflare-access.guard.spec.ts`.
  Require failures caused by the missing mode, not import/setup errors.
- [x] Implement the enum/default, conditional Access validation and guard denial.
  Reject disabled admin routes before the existing NODE_ENV development exemption.
  Preserve all existing cloudflare behavior and localized error handling.
- [x] Rerun both suites plus `src/config/env.validation.spec.ts`,
  `src/common/auth/cloudflare-access-verifier.spec.ts` and `src/common/auth/guards.spec.ts`;
  require all selected tests to pass.

### Task 2: HTTP boundary, deployment contract and handoff

**Files:** Create API `src/common/auth/admin-disabled-http.spec.ts`; modify `.env.example`,
`docs/core/deployment.md`, `docs/features/deployment.md` and the selected design/evidence.
Do not modify the optional paid Blueprint or shared feature catalog defaults.

**Interfaces:** No new public endpoint or generated client contract. Document explicit
`ADMIN_ACCESS_MODE=disabled` for the trial and unchanged default/cloudflare operation.

- [x] Add a minimal Nest/Supertest fixture with the real global guard and synthetic
  admin handlers, no DB or external services. Requests to representative admin API,
  reembed and admin auth paths must never call handlers or issue Set-Cookie.
  Cover old privileged sessions/forged assertions and a working ordinary user route.
- [x] Inventory actual controller prefixes under `apps/api/src/modules/**/presentation`
  and identity's admin method paths. Verify every admin-only route is inside the
  protected boundary; add cases for exceptions instead of assuming AdminModule removal.
- [x] Run the HTTP suite with the unit config (no DB global setup) and confirm success.
  Preserve existing origin and auth guard regressions; do not pretend this minimal
  fixture proves full application signup/refresh or hosted routing.
- [x] Document no admin service/domain, reserved ADMIN_APP_URL/CORS behavior, explicit
  closed forum/mentorship/coach-signup/digest/sponsorship flags, and offline configuration
  changes requiring controlled API restart because the registry is process-cached.
- [x] Document the no-admin support gate and safe rollback artifact requirement.
  Restoring old code without Access cannot be described as a working rollback.
- [x] Run API typecheck, ESLint on owned TypeScript files, focused suites and diff checks.
  If targeted failures indicate wider impact, broaden only the relevant checks.
- [x] Review the scoped diff; commit is deferred to preserve concurrent work. If committing later, ensure
  the checkout permits it. Never stage concurrent owner edits or push/merge implicitly.

## Exit criteria

The local boundary works and its targeted regressions pass. Final fixed-commit full CI,
actual deployment, role/edge verification, credentials, quotas, storage costs and cold-start
acceptance remain release gates. No release-ready claim from this scoped implementation.


## Execution result

Local implementation and targeted checks complete; independent scoped review found no
blocking issue. Commit steps are explicitly deferred in the shared dirty checkout.
No live flag/provider change, full CI, merge, push or release was performed.
Evidence: [implementation record](../../qa/2026-10-29-closed-trial-implementation.md).

