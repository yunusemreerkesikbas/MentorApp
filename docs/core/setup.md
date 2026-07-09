# Local Setup

## Prerequisites
- **Node ≥ 22** (`.nvmrc` = 22; Node 24 also works on the current dev machine).
- **pnpm** (via Corepack: `corepack enable`). Version in `package.json > packageManager`.
- **Docker** (Docker Desktop running) — for the local Postgres.
- Git.

## Steps
```bash
# 1) Dependencies (from root — entire workspace)
pnpm install

# 2) Environment
cp .env.example apps/api/.env   # API secrets + W5 vars (see below)
# Web push needs a separate file (Next.js reads apps/web only):
#   apps/web/.env.local → NEXT_PUBLIC_API_URL + NEXT_PUBLIC_VAPID_PUBLIC_KEY

# 3) Local database (docker — Postgres 16 + pgvector, host port 5433)
pnpm db:up                      # start; `pnpm db:down` to stop
pnpm --filter @mentor/api db:migrate   # apply migrations (extensions + jobs)

# 4) Development — all
pnpm dev                    # api:3001/v1 · web:3000 · admin:3002
#    or a single app
pnpm --filter @mentor/web dev
```

## Optional — Headroom (compress LLM context while coding)

Reduces token use in **Cursor / Claude Code / Codex** when working on this repo (separate from the koç API feature):

```bash
pnpm headroom:install
pnpm headroom:wrap cursor    # or claude | codex
```

Guide: [dev/headroom.md](../dev/headroom.md).

## W5 · Notifications (local smoke test)

Queue + email + push live in the **notifications** module — see [features/notifications.md](../features/notifications.md).

**Env files (git-ignored)**

| File | Variables |
|---|---|
| `apps/api/.env` | `CRON_SECRET` (≥32 chars), optional `POSTMARK_TOKEN` + `POSTMARK_FROM`, `VAPID_*` |
| `apps/web/.env.local` | `NEXT_PUBLIC_API_URL=http://localhost:3001/v1`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (= API public key) |

Copy W5 keys from [`.env.example`](../.env.example). Generate VAPID: `npx web-push generate-vapid-keys`.

Without `POSTMARK_TOKEN`, emails are **logged** (not sent). Without VAPID, push jobs log only; profil shows a config hint until web public key is set. Restart `pnpm dev` after env changes.

**Run the job runner manually** (Render Cron equivalent):

```bash
# Process queued jobs (signup mail, payment mail, push, …)
curl -X POST http://localhost:3001/v1/internal/cron/process-jobs \
  -H "x-cron-secret: $CRON_SECRET"

# Rule-based daily reminders → enqueues email/push jobs (then run process-jobs again)
curl -X POST http://localhost:3001/v1/internal/cron/dispatch-daily-reminders \
  -H "x-cron-secret: $CRON_SECRET"
```

Quick checks: register a user → job row in `jobs` → `process-jobs` → completed; `/profil` → enable push → dispatch + process cron.

## Tests
```bash
pnpm db:up                              # e2e needs the local Postgres
pnpm --filter @mentor/api test          # vitest unit + e2e
```
CI runs the same against a Postgres service (see `.github/workflows/ci.yml`).

## Verification
```bash
curl http://localhost:3001/v1/health     # {"status":"ok",...}
# web  → http://localhost:3000   (brand shell, DESIGN tokens)
# admin→ http://localhost:3002   (admin shell)
pnpm typecheck && pnpm lint && pnpm build
```

## Ports
| App | Port |
|---|---|
| api | 3001 (`/v1`) |
| web | 3000 |
| admin | 3002 |
| postgres (docker) | 5433 → 5432 |

## Troubleshooting
- **`mixin.stripAnsi is not a function`** (on every command in Bash): noise from a global Angular shim;
  the command still runs. Use **PowerShell** for scaffolding/long commands.
- **`@mentor/ui` type error (dev):** packages must be built first → `pnpm build` (turbo orders `^build`)
  or `pnpm --filter @mentor/ui build`.
- **Next.js 16:** for breaking changes, see the per-app `AGENTS.md` → `node_modules/next/dist/docs/`.
- **pnpm 11 blocks native build scripts** → approve them in `pnpm-workspace.yaml > allowBuilds`
  (esbuild/sharp/@nestjs/core/unrs-resolver = true).
