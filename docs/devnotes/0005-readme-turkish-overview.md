# 0005 — README → Turkish Product Overview

> Date: 2026-06-07 · Scope: documentation · Related: roadmap §0–§10, AGENTS.md §7

## What was done
- Rewrote `README.md` as a **Turkish, product-facing overview** that summarizes `sinav-kocluk-roadmap.md`
  (positioning/spirit, the three layers AI-coach/ritual/community, key design principles, business model,
  phase roadmap, tech stack, doc map).
- Setup details moved out → README now points to `docs/setup.md` instead of inlining commands.
- Recorded the language exception in AGENTS.md §7 + conventions.md: `README.md` and the roadmap are
  intentionally Turkish (product/user-facing); all other engineering docs stay English.

## How to use (usage)
- README is the front door for developers/users (Turkish). Deep engineering detail → `AGENTS.md` + `docs/`.
- Keep README a *summary* — when product decisions change, update the roadmap (source of truth) first, then sync README.

## Gotchas
- Don't "fix" README/roadmap to English — the exception is intentional (AGENTS.md §7).

## Related files & decisions
- `README.md` · `AGENTS.md` §7 · `docs/conventions.md`
