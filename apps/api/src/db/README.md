# db — Drizzle + Neon (§8)

- `index.ts` — **dual driver** (lazy):
  - `createDb` → `neon-http` (stateless, simple reads, scale-to-zero friendly).
  - `createDbPool` → `neon-serverless` WebSocket Pool (**tx-scoped → RLS-session**, writes, the Cron queue worker).
  - Reason: neon-http issues a separate HTTP request per query → it doesn't share the `SET app.user_id` session → RLS is unreliable.
- `schema.ts` — Drizzle table definitions (§11). An empty skeleton for now.
- `../../drizzle/` — migrations produced by `drizzle-kit generate` (kept in version control).

## Commands
```bash
pnpm --filter @mentor/api db:generate   # schema → SQL migration
pnpm --filter @mentor/api db:migrate    # apply migrations
pnpm --filter @mentor/api db:studio     # Drizzle Studio
```
Requires `DATABASE_URL` (Neon, EU region) — see `.env.example` / `docs/integrations.md`.
