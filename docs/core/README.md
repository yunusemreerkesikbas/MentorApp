# Core — Platform Documentation

> Non-feature, cross-cutting foundation that every module builds on. Canonical guides live at repo
> root: [`../../AGENTS.md`](../../AGENTS.md) (engineering/agent guide) · [`../../sinav-kocluk-roadmap.md`](../../sinav-kocluk-roadmap.md) (product decisions, Turkish) · [`../../DESIGN.md`](../../DESIGN.md) (design tokens).

## Foundation (what the platform is)

- **[architecture.md](./architecture.md)** — modular monolith + pragmatic clean + DDD; module map, event-driven backbone, AI coach architecture, cost/security shield, high-level diagram.
- **[base-infrastructure.md](./base-infrastructure.md)** — the shared substrate: monorepo skeleton, single `pg` Pool + Drizzle, RLS via `SET LOCAL`, errors/i18n/logging/health/OpenAPI/security/tests.
- **[repo-and-conventions.md](./repo-and-conventions.md)** — code style, naming, language policy, git workflow, ticket registry, feature-doc rule, testing, agent-skills.
- **[design-system.md](./design-system.md)** — `@mentor/ui` primitive library + DESIGN.md token implementation (Tailwind v4 `@theme`).

## Planning & status

- **[workstreams.md](./workstreams.md)** — parallel MVP tracks (W0–W7) with exclusive ownership boundaries + shared-file touch rules.
- **[mvp-status.md](./mvp-status.md)** — one-page snapshot of what's built vs pending (✅/🟡/⏳/⛔), per workstream + per-slice breakdowns + known issues + guardrails honored.

## Setup & operations

- **[setup.md](./setup.md)** — local setup (Node/pnpm/Docker/Postgres), env files, W5 notifications smoke test, ports, troubleshooting.
- **[integrations.md](./integrations.md)** — account + environment wiring for Neon / OpenAI / Gemini / iyzico / Cloudflare R2+Turnstile+Access / Postmark / Sentry / Render.
- **[security-release-checklist.md](./security-release-checklist.md)** — production session/key rotation, restricted DB role, private-media migration and browser/security release gates.
- **[file-structure.md](./file-structure.md)** — monorepo folder tree + package dependency direction + module internal structure.
- **[conventions.md](./conventions.md)** — cross-cutting basics: language, config & secrets, git, **ticket registry (APP-NNN)**, feature-doc rule, testing, quality gates.

## How core relates to features

Feature work (`docs/features/*`) documents **what each bounded context does**; core documents **how the
platform underneath them works**. A feature doc assumes its reader knows the foundation (RLS context,
error envelope, config registry, `@mentor/ui` tokens). Feature progress is tracked in [mvp-status.md](./mvp-status.md).

## Standards (binding — checked in PR review)

The standards live in [`../standards/`](../standards/) (kept at `docs/standards/` so AGENTS.md §10
paths stay valid): engineering-principles · code-style · api (incl. service catalog) · backend · frontend · mobile · code-review.
