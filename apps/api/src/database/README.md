# database — Drizzle + Postgres (§8)

**Single driver:** `drizzle-orm/node-postgres` (`pg` Pool). Works against local Postgres (docker)
and Neon (wire-compatible) → dev/prod parity. A pooled TCP connection supports transactions +
RLS session GUCs (`SET LOCAL`); the API is a persistent Render service (not edge), so no edge driver.

- `drizzle.ts` — `createPool` / `createDatabase`, `Database` + `DatabaseTx` types.
- `database.module.ts` — global module; provides `DRIZZLE` + `PG_POOL`; graceful pool drain on shutdown.
- `rls.ts` — `withUserContext(db, ctx, fn)`: tx-scoped `app.user_id`/`app.org_id`/`app.role` for RLS.
- `schema.ts` — Drizzle tables (§11). Base ships `jobs`; feature tables arrive with their modules.
- `../../drizzle/` — generated migrations (kept in version control).

## Commands
```bash
pnpm db:up                              # local Postgres (docker, pgvector)
pnpm --filter @mentor/api db:generate   # schema → SQL migration
pnpm --filter @mentor/api db:migrate    # apply migrations
pnpm --filter @mentor/api db:studio     # Drizzle Studio
```
`DATABASE_URL` is required (see `.env.example`). Migrations are NOT auto-applied on boot (separate release step).
