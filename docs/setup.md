# Local Setup

## Prerequisites
- **Node ≥ 22** (`.nvmrc` = 22; Node 24 also works on the current dev machine).
- **pnpm** (via Corepack: `corepack enable`). Version in `package.json > packageManager`.
- Git.

## Steps
```bash
# 1) Dependencies (from root — entire workspace)
pnpm install

# 2) Environment
cp .env.example .env        # fill in values → docs/integrations.md

# 3) (Optional) DB schema — if DATABASE_URL is set
pnpm --filter @mentor/api db:generate
pnpm --filter @mentor/api db:migrate

# 4) Development — all
pnpm dev                    # api:3001/v1 · web:3000 · admin:3002
#    or a single app
pnpm --filter @mentor/web dev
```

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

## Troubleshooting
- **`mixin.stripAnsi is not a function`** (on every command in Bash): noise from a global Angular shim;
  the command still runs. Use **PowerShell** for scaffolding/long commands.
- **`@mentor/ui` type error (dev):** packages must be built first → `pnpm build` (turbo orders `^build`)
  or `pnpm --filter @mentor/ui build`.
- **Next.js 16:** for breaking changes, see the per-app `AGENTS.md` → `node_modules/next/dist/docs/`.
- **pnpm 11 blocks native build scripts** → approve them in `pnpm-workspace.yaml > allowBuilds`
  (esbuild/sharp/@nestjs/core/unrs-resolver = true).
