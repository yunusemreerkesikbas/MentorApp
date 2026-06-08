# Devnotes — Development Log (usage / tutorial / devnotes)

> **Rule (binding):** After every meaningful development, leave a **short, clear, explanatory** note here.
> Purpose: a living usage/tutorial record → faster onboarding, agents find context, the "why" isn't lost.

## When to leave a note
- New module/feature/endpoint · new package or integration · architecture decision · schema/migration ·
  a gotcha worth flagging.
- Not needed for trivial changes (typo, formatting).

## How
1. Copy `_template.md` → `NNNN-kebab-title.md` (next number, 4 digits: `0003-identity-auth.md`).
2. Keep it short: **what was done · how to use · gotchas · related files/decisions.** Quick reference, not an essay.
3. Include it in the PR (review checks for the devnote — [code-review.md](../standards/code-review.md)).

## Format
- **Language:** English, bullet points. Short snippet if a code example is needed.
- **Links:** relevant roadmap section (§x), standard, file path.
- Numbers increase; files are **not deleted** (historical record) — if wrong, add a correction note.

## Index
| # | Title | Scope |
|---|---|---|
| [0001](./0001-project-initialization.md) | Project initialization | Monorepo skeleton, apps, packages, queue/RLS decisions |
| [0002](./0002-standards-and-conventions.md) | Standards & naming | code-style/api + backend/frontend/mobile/code-review standards |
| [0003](./0003-docs-english-refactor.md) | Docs & comments → English | engineering docs + code comments translated; roadmap stays Turkish |
| [0004](./0004-engineering-principles.md) | Engineering principles | SOLID/DRY/KISS/YAGNI, fallbacks, logic-backend-only, localized messages, Definition of Done |
| [0005](./0005-readme-turkish-overview.md) | README → Turkish overview | README summarizes the roadmap (Turkish, product-facing); setup moved to docs/setup.md |
| [0006](./0006-gitignore-and-repo-hygiene.md) | .gitignore & repo hygiene | skill libs ignored (~486→109 tracked files), LICENSE added, per-app gitignore removed |
