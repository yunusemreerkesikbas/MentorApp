# File Structure

```
MentorApp/
├── apps/
│   ├── api/                 NestJS modular monolith (runs) — /v1
│   │   ├── src/
│   │   │   ├── main.ts          bootstrap (/v1, shutdown hooks)
│   │   │   ├── app.module.ts    root module (Config + Health)
│   │   │   ├── config/          env schema (Zod) + validateEnv
│   │   │   ├── health/          GET /v1/health
│   │   │   ├── shared/ports/    Ports & Adapters contracts
│   │   │   ├── modules/         bounded-context skeletons
│   │   │   └── db/              Drizzle + Neon (schema skeleton)
│   │   ├── drizzle/             migration outputs (kept in version control)
│   │   ├── drizzle.config.ts
│   │   └── nest-cli.json
│   ├── web/                 Next.js B2C (runs) — :3000
│   ├── admin/               Next.js lean admin (runs) — :3002
│   ├── mobile/              Expo placeholder (Phase 2)
│   └── panel/               coach+B2B placeholder (Phase 2)
├── packages/
│   ├── types/              shared TS types + stable enums (§11)
│   ├── validation/         Zod schemas (FE+BE)
│   ├── core/               exam-agnostic config constants (net rule, etc.)
│   ├── api-client/         orval-generated client (skeleton)
│   ├── ui/                 DESIGN.md tokens (Tailwind v4 @theme + TS) + primitives
│   └── config/             shared tsconfig / eslint bases
├── docs/                   core/ · features/ · standards/ · plans/
├── .github/
│   ├── workflows/ci.yml    lint + typecheck + build
│   └── prompts/            ui-ux-pro-max skill data (tooling — kept)
├── AGENTS.md  CLAUDE.md  README.md
├── sinav-kocluk-roadmap.md (Turkish)  DESIGN.md
├── turbo.json  pnpm-workspace.yaml  package.json
└── .env.example  .gitignore  .nvmrc  .npmrc  eslint.config.mjs
```

## Package dependency direction
```
ui ───┐
types ┼─→ validation ─┐
core ─┘               ├─→ apps/api
config (dev base) ────┤
api-client ───────────┴─→ apps/web, apps/admin  (+ ui)
```
Internal rule: `apps/*` → `packages/*` (one direction). Packages never depend on apps.

## Module internal structure (critical-domain example)
```
modules/<context>/
├── domain/          entity, value object, domain event (framework-agnostic)
├── application/     use-case / service, port interfaces
├── infrastructure/  repository (Drizzle), adapter
└── presentation/    controller (REST /v1), DTO (Zod)
```
A simple CRUD module doesn't need this many layers (pragmatic clean).
