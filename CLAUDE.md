# CLAUDE.md

> **Full engineering & agent guide → [`AGENTS.md`](./AGENTS.md)** (canonical).
> Product decisions → [`sinav-kocluk-roadmap.md`](./sinav-kocluk-roadmap.md) (Turkish). Design → [`DESIGN.md`](./DESIGN.md).

## Project in 30 seconds
**Mentor** — an **AI coach + community "companionship platform"** for exam prep (not a knowledge
platform). Exam-agnostic (KPSS first); exams differ only by content/config. MVP = responsive web
B2C + lean admin. Stack: TypeScript monorepo · NestJS · Next.js · Neon+Drizzle+pgvector (dual driver)
· Cron+jobs queue (`JobQueuePort`) · Cloudflare · Render · iyzico · OpenAI+Gemini · Postmark · Sentry.

## Frequent commands
```bash
pnpm install
pnpm dev                              # api:3001 · web:3000 · admin:3002
pnpm --filter @mentor/api dev         # single app
pnpm build | lint | typecheck
```

## Remember while working
- First, **AGENTS.md §4 guardrails** (LLM never generates official info, photo categorizes-not-solves,
  coin is non-monetary, no AI on free, AI→teacher trust line, KVKK, org-ready schema).
- UI values come from **DESIGN.md tokens** (`@mentor/ui`), not magic numbers.
- Per-task skill: `senior-architect` / `senior-backend` / `senior-frontend`.
- Relevant **standard** before coding: `docs/standards/{backend,frontend,mobile,code-review}.md`.
- **After every meaningful development, add `docs/devnotes/NNNN-title.md`** (usage/gotchas) — mandatory.
- Don't implement out-of-scope ideas inline → backlog (phase discipline, roadmap §10).
- This repo is **its own git repository** (isolated from the home directory).

## Environment note
In the Bash tool, every command may print a `mixin.stripAnsi is not a function` error (a global Angular
shim); the command still runs. For stability during scaffolding, prefer **PowerShell**.
