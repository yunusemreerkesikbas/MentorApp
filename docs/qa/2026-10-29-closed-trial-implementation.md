# Closed trial: local implementation evidence

2026-10-29. Owner approved both plans and inline execution in the original dirty
`feature/APP-122` checkout. HEAD stayed at `e2e9bd734539e7929446e63576169f0c04e0a337`.
Implementation is uncommitted; no index/branch, provider account, live flag, deployment,
credential, DNS or billing change. Existing notebook/quota/queue/UI work was preserved.

## Implemented behavior

- `ADMIN_ACCESS_MODE` defaults to `cloudflare`. Explicit `disabled` rejects all admin
  API/auth routes through the existing global guard, including old privileged sessions
  and supplied Access assertions, before handlers or Access/identity lookup. Only
  production Access issuer/audience requirements are deferred. Other security checks
  remain mandatory. Disabled applies even if NODE_ENV is development.
- Text completion, consumed streams, embeddings and vision recheck `ai.enabled` at
  the decorated provider boundary before budget/provider calls. Disabled operations
  return existing `AI_DISABLED` (404). A queued article embedding cannot write its
  vector while disabled. Enabled privacy/reservation behavior is retained.
- Deployment/env/security instructions record core-only flags, no admin frontend,
  process-cached override restarts, support/incident limits and compatible rollback.

## RED and GREEN

| Check | Result |
| --- | --- |
| Admin RED | 18 failures and 28 passes exposed the missing mode/denial. |
| Admin GREEN | 161/161 tests, 8 files: env/admin validation, Access guard/verifier, role guards, minimal Nest admin HTTP, auth origins and real Express edge boundary. |
| AI RED | 10 failures and 3 existing lifecycle passes exposed provider calls while off, including a queued embedding. |
| AI GREEN | 30/30 tests, 5 files: provider kill-switch, prompt privacy, vision reservations, budget guard and article listener. |
| API typecheck | Exit 0, `tsc -p tsconfig.json --noEmit`. |
| Owned-file ESLint | Exit 0 on the 11 owned TypeScript source/test files. |
| Diff/document checks | Tracked scoped whitespace checks and local document link checks passed. |
| Independent review | One read-only review found no concrete Critical/Important/Minor finding; reviewer did not rerun tests. |

Vitest ran using the checked-in `vitest.unit.config.ts` and installed local Node/Vitest;
Corepack initially tried fetching pnpm/latest and failed before any test ran. No dependency
was installed. HTTP tests initially encountered restricted loopback EACCES, then passed
through normal approved escalation. They used only local fixture servers, no real DB,
mail, AI or other provider. Access cryptography uses local generated fixture keys.
The existing Vite CJS deprecation warning remains.

The first broader admin check found one test expectation using a missing R2 key name
instead of the existing aggregate R2 error path. Corrected that fixture expectation;
production R2 validation was not changed. All final selected tests passed afterward.

Full outputs and per-plan progress ledgers are retained in ignored
`.superpowers/sdd/2026-10-29-{admin-closed-trial,ai-provider-kill-switch}/` directories.

## Decisions and limits

- Retained the accepted original checkout rather than switching branches/worktrees.
  Risk: concurrent work must be included in final fixed-commit verification.
- Used native PowerShell ledgers and installed tools instead of POSIX helpers/Corepack
  network resolution. Risk: this verifies local code, not a clean package installation.
- Kept approved loopback-only HTTP evidence separate from hosted edge acceptance.
  Risk: Cloudflare/Render routing, cookies and cold starts still require rehearsal.
- Did not review/alter the owner's notebook/catalog/entitlement/UI/queue corrections.
  Risk: these are not validated by this scoped review or these test counts.
- Deferred enabled embedding usage accounting. Risk: do not activate AI believing the
  monthly application cap includes every embedding charge or enforces the invoice.
- Kept work uncommitted and retained evidence to avoid mixing concurrent edits.
  Risk: there is no atomic reviewed release commit or compatible built rollback artifact.

No minor finding was deferred by the independent review. Actual provisioning, restricted
database roles/migrations/recovery, production overrides/content, total R2 spending,
support operation, hosted auth/mail/upload/queue acceptance and full CI remain open.
This completes the two local implementation plans, not publication readiness.

Usage: [deployment profile](../core/deployment.md#closed-admin-core-only-free-trial).
Plans: [admin](../superpowers/plans/2026-10-29-admin-closed-trial.md),
[AI](../superpowers/plans/2026-10-29-ai-provider-kill-switch.md).
