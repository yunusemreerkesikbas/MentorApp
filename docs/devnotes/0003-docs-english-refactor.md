# 0003 — Documentation & Comments → English

> Date: 2026-06-07 · Scope: documentation / code comments · Related: AGENTS.md §7 (language)

## What was done
- All engineering/agent docs translated to English: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/**`
  (architecture, conventions, file-structure, setup, integrations, standards/*, devnotes/*), all app and
  package `README.md`, and the project-header parts of `apps/web|admin/AGENTS.md`.
- All **code comments** translated to English (apps/api src, packages src, config files), plus
  `package.json` descriptions, `.env.example`, and the `.gitignore` note.
- Language convention updated: code/identifiers English, **comments & docs English**, **user-facing UI text Turkish**.

## How to use (usage)
- New docs/comments are written in English from now on (see AGENTS.md §7 / conventions.md).
- The Turkish UI copy in `apps/web|admin/src/app/*` is intentional (Turkish product) — keep UI strings Turkish.

## Gotchas
- **Roadmap (`sinav-kocluk-roadmap.md`) stays Turkish** by decision — it's the product decision record;
  English docs reference its sections as `§x`.
- `DESIGN.md` was already English; the Turkish glyphs in it are intentional (glyph-coverage examples).
- The `.agents/.cursor/...` skill libraries are third-party — not translated.

## Related files & decisions
- `AGENTS.md` §7 (language) · `docs/conventions.md`
- Verification: typecheck 12/12 · lint 12/12 · build 8/8 · `/v1/health` 200
