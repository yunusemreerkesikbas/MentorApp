# Core Architecture & Operations Docs (`docs/core/`)

Foundational architecture, infrastructure, conventions, and operational runbooks for the Mentor (`PuhuKoç`) monorepo.

| File | Description |
|---|---|
| [`architecture.md`](./architecture.md) | System architecture, bounded contexts, event-driven communication, RLS, and ports & adapters |
| [`base-infrastructure.md`](./base-infrastructure.md) | NestJS foundation: `pg` Pool, `withUserContext`/`withServiceContext`, `ConfigService`, `JobQueuePort`, OpenAPI |
| [`conventions.md`](./conventions.md) | Language rules, shared packages, Git workflow, modularity targets, and ticket registry (`0001–0042`, `APP-001–APP-138`) |
| [`design-system.md`](./design-system.md) | `@mentor/ui` package guide, tokens (`theme.css`), and bridge to [`DESIGN.md`](../../DESIGN.md) |
| [`file-structure.md`](./file-structure.md) | Monorepo directory layout and NestJS/Next.js module anatomy |
| [`setup.md`](./setup.md) | Local development environment setup, database migrations, seeds, and test commands |
| [`deployment.md`](./deployment.md) | Render deployment blueprint, cron jobs, closed-trial/zero-cost provider modes, and migration runbook |
| [`storage-r2.md`](./storage-r2.md) | Cloudflare R2 presigned upload architecture, storage quotas, and retention cleanup |
| [`integrations.md`](./integrations.md) | External service configuration (OpenAI, Gemini, Resend, Netgsm, iyzico, Cloudflare, Google OAuth) |
| [`security-release-checklist.md`](./security-release-checklist.md) | Pre-launch security, RLS, rate limiting, and KVKK verification checklist |
| [`deferred-staging.md`](./deferred-staging.md) | Production credentials and third-party items deferred until live commercial launch |
| [`workstreams.md`](./workstreams.md) | Workstream ownership boundaries (`W1–W8`) and shared-file modification rules |
| [`mvp-status.md`](./mvp-status.md) | Current implementation status across all modules |
