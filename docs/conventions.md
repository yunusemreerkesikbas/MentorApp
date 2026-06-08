# Conventions

> Naming, code style, and per-stack rules live in [standards/](./standards/) (canonical). This file holds
> only the cross-cutting basics not repeated there.

## Language
- Code / identifiers / file names: **English**. Comments / engineering docs: **English**. User-facing text: **Turkish** (§0 tone).
- Intentionally Turkish: `README.md` (product overview) + `sinav-kocluk-roadmap.md` (product decisions).

## Config & secrets
- Tunables (coin/XP caps, rate-limit, price, thresholds) → central **config registry** (typed + Zod, §9);
  no magic numbers. Sensitive (money) → bounds + audit.
- Secrets in `.env` (git-ignored). Template `.env.example`. Steps in `docs/integrations.md`.

## Git
- **Conventional Commits** (`feat/fix/chore/docs/refactor/test`). `main` protected; `feat/<topic>` → PR → squash.
- Commit/PR only when the user asks; `.env` is never committed.

## Standards (binding)
Engineering principles · code-style (naming) · api · backend · frontend · mobile · code-review →
[standards/](./standards/code-review.md). Full index: [docs/README.md](./README.md).

## Devnote (mandatory)
After every meaningful development, add a short note under [devnotes/](./devnotes/README.md)
(`NNNN-title.md`, from `_template.md`). No devnote → no merge.

## Testing (later)
Unit: domain/use-case. Integration: repository + adapter. E2E: critical flows (auth, payment webhook
idempotency). The skeleton has no suite yet — update here once added.

## Quality gates (CI)
`pnpm lint` · `pnpm typecheck` · `pnpm build` must be green to merge (`.github/workflows/ci.yml`).
