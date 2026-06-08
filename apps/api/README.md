# apps/api — Mentor Backend (NestJS modular monolith)

A single API, versioned `/v1`, serving web + (Phase 2) mobile + panel (§8).

## Run
```bash
pnpm --filter @mentor/api dev      # nest start --watch → http://localhost:3001/v1
curl http://localhost:3001/v1/health
```

## Structure
```
src/
├── main.ts                bootstrap (/v1 prefix, shutdown hooks)
├── app.module.ts          root module (ConfigModule + HealthModule)
├── config/                env schema (Zod) + validateEnv
├── health/                GET /v1/health
├── shared/ports/          Ports & Adapters contracts (LLM/Payments/Storage/Email/JobQueue)
├── modules/               bounded-context skeletons (§8 module map)
└── db/                    Drizzle + Neon (schema skeleton, lazy connection)
```

## Architecture rules (§8)
- Modules never touch each other's tables → public interface / **domain event** (`EventEmitter`).
- Pragmatic Clean: layer depth scales with the work (simple CRUD ≠ critical domain).
- Ports & Adapters: external providers (LLM/iyzico/R2/Postmark) are pluggable.
- Append-only ledger (XP/coin), idempotent webhook, outbox — in the economy/payments modules.
- Queue behind `JobQueuePort`: MVP = Render Cron + jobs table; Phase 2 = BullMQ+Redis.
- DB dual driver: RLS-session + writes via tx-scoped Pool, simple reads via neon-http.

Env: `.env.example` (root) + `docs/integrations.md`.
