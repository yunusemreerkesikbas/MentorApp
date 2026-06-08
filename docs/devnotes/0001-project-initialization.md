# 0001 — Project Initialization

> Date: 2026-06-07 · Scope: architecture / monorepo / all apps+packages · Related: roadmap §8/§10

## What was done
- Isolated git repo + **Turborepo + pnpm** monorepo set up (`@mentor/*` scope).
- **Runnable app shells:** `apps/api` (NestJS 11, `/v1/health`), `apps/web` & `apps/admin` (Next.js 16 +
  React 19 + Tailwind v4, DESIGN.md tokens). `apps/mobile` + `apps/panel` = Phase 2 placeholders.
- **Packages:** `types · validation(zod) · core · api-client · ui · config`.
- **Ports & Adapters contracts:** `llm · vision · payments · storage · email · job-queue`.
- **DB:** Drizzle + Neon **dual driver** (`createDb` neon-http / `createDbPool` tx-scoped Pool → RLS).
- **Queue decision (correction):** pg-boss dropped → `JobQueuePort` (MVP: Render Cron + jobs table; Phase 2: BullMQ+Redis).
- Docs + 4 standards (backend/frontend/mobile/code-review) + the devnotes process.

## How to use (usage)
```bash
cp .env.example .env        # fill in with docs/integrations.md
pnpm install
pnpm dev                    # api:3001/v1 · web:3000 · admin:3002
curl http://localhost:3001/v1/health
pnpm typecheck && pnpm lint && pnpm build
```

## Gotchas
- **pnpm 11** blocks native builds → `pnpm-workspace.yaml > allowBuilds` (esbuild/sharp/nest/unrs-resolver true).
- **nest build:** incremental is off (`@mentor/config/tsconfig/nestjs.json`) — when on, deleteOutDir produced a stale `dist`.
- **Validation is Zod** (not class-validator) → the global `ValidationPipe` is not used.
- The Bash tool prints `mixin.stripAnsi` noise; commands still run → prefer PowerShell for scaffolding.
- `create-next-app` drops a `pnpm-workspace.yaml` into each app → removed (conflicts with the root workspace).

## Related files & decisions
- `AGENTS.md` (canonical) · `docs/architecture.md` · `docs/standards/*`
- `apps/api/src/{main,app.module}.ts` · `apps/api/src/db/index.ts` · `apps/api/src/shared/ports/*`
- Decision: queue = `JobQueuePort` (Cron→BullMQ) · DB = dual driver (tx Pool for RLS)
