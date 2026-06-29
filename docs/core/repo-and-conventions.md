# Repo & Conventions

> Cross-cutting repo/engineering conventions: code style, naming, language policy, git workflow,
> ticket registry, the devnote/feature-doc rule, testing, agent-skills. Not a feature — it governs all
> features. Canonical list: [standards/](../standards/code-review.md) + [AGENTS.md §7/§10](../../AGENTS.md).

## Overview

How code is written, named, committed, branched, and documented across the whole monorepo. These rules
exist so parallel agents/tracks produce consistent, reviewable work. The binding detail lives in
`docs/standards/*`; this doc holds the cross-cutting basics + the project history of those rules.

## Architecture (the convention model)

- **Language:** code/identifiers/comments/engineering-docs = **English**; user-facing text = **Turkish**
  (§0 tone). Intentionally Turkish: root `README.md` + `sinav-kocluk-roadmap.md` (product-facing).
- **Naming (file/class/variable/DB/event):** [code-style.md](../standards/code-style.md) is canonical.
- **Validation:** Zod single source (`@mentor/validation`), shared FE+BE.
- **Types:** shared contracts in `@mentor/types`. Avoid `any`.
- **Config:** tunables in a central **config registry** (typed + Zod, §9) — no magic numbers. Secrets
  in `.env` (never the registry).
- **Git:** Conventional Commits (`feat/fix/chore/docs/refactor/test`). `master` protected; PR → squash.
  Branch: `feature/APP-NNN-<slug>`; one branch per track (parallel agents never share a branch).
- **Feature-doc rule:** after every meaningful development, add a note to the relevant
  [`docs/features/<bucket>.md`](../features/README.md) (what · how to use · gotchas · related files).
  No doc update → no merge. *(Replaces the old chronological `docs/devnotes/NNNN` scheme.)*

## Tutorials / Guides

### Branch + ticket registry

When opening a branch, add a row to the ticket registry in [conventions.md](./conventions.md):

```bash
git checkout -b feature/APP-014-<short-slug>
# then append a row to docs/core/conventions.md "Ticket registry" table
```

### Adding a feature-doc entry

When you finish meaningful work, append a dated entry to the matching `docs/features/<feature>.md`
under "Geliştirmeler (timeline)". Keep it short: **what was done · how to use · gotchas · related files.**

## API

N/A (engineering rules, not endpoints).

## Geliştirmeler (timeline)

- **Standards & naming** — code-style/api + backend/frontend/mobile/code-review standards written.
  *(0002.)*
- **Docs & comments → English** — engineering docs + code comments translated to English; roadmap stays
  Turkish. *(0003.)*
- **Engineering principles** — SOLID/DRY/KISS/YAGNI, balanced robustness (no silent fallbacks),
  logic-backend-only, localized messages, Definition of Done (incl. dead-code cleanup). *(0004.)*
- **README → Turkish overview** — root README summarizes the roadmap (Turkish, product-facing); setup
  moved to [setup.md](./setup.md). *(0005.)*
- **.gitignore & repo hygiene** — skill libs ignored (~486→109 tracked files), LICENSE added, per-app
  gitignore removed. *(0006.)*
- **Agent skills ↔ standards** — senior-frontend/backend/architect + code-reviewer skills rewritten
  with binding rules from `docs/standards`. *(0029.)*

## Gotchas / Known issues

- **Package barrel imports cause cycles:** inside a package, import from leaf modules, **never the
  barrel** (`validation/index.ts` ↔ `validation/coaching.ts` once crashed ESM-from-CJS loading). The
  shared `paginationQuerySchema` was moved to its own `pagination.ts`.
- **Ticket registry must be maintained:** it fell out of date after APP-001 (the recon of APP-002..013
  is in [conventions.md](./conventions.md)); keep it current when you open a branch.
- **Feature-doc replaces devnotes:** the old `docs/devnotes/NNNN-title.md` chronological log was
  consolidated into `docs/features/<bucket>.md`. Don't recreate the flat numbered scheme.

## Related

- [conventions.md](./conventions.md) (basics + ticket registry) · [architecture.md](./architecture.md)
- Standards (binding): [code-style.md](../standards/code-style.md) · [engineering-principles.md](../standards/engineering-principles.md) · [api.md](../standards/api.md) · [code-review.md](../standards/code-review.md)
- [AGENTS.md §7 Conventions](../../AGENTS.md) · [AGENTS.md §10 Standards & documentation](../../AGENTS.md)
