# 0002 — Standards & Naming Conventions

> Date: 2026-06-07 · Scope: documentation / standards · Related: AGENTS.md §10

## What was done
- 6 binding standards documents completed: **code-style** (naming + code style), **api**
  (design/versioning + service catalog), backend, frontend, mobile, code-review.
- Naming finalized: files (`kebab-case` + role suffix / React `PascalCase`), identifiers
  (class `PascalCase`, constant `UPPER_SNAKE`, boolean `is/has`), DB (`snake_case`), event/job (`module.action`).
- API standard: `/v1` versioning policy, resource naming, status codes, `ApiError`/`Paginated`
  envelopes, pagination/sorting/filtering, idempotency, **service (module) catalog**.

## How to use (usage)
- Before writing code, open the relevant standard: `docs/standards/code-style.md` + backend/frontend/mobile per area.
- When adding an endpoint: update the `docs/standards/api.md` service catalog + OpenAPI.
- On naming uncertainty, the **code-style.md tables** are final (not a debate).

## Gotchas
- `conventions.md` is now a summary; the **canonical source for naming/style is `code-style.md`** (it wins on conflict).
- Money fields: no float → store `numeric`/minor-unit, transport as a string in the API.
- Event/job strings are lowercase-dotted (`forum.post.verified`, `ai.analyze-mock`).

## Related files & decisions
- `docs/standards/{code-style,api,backend,frontend,mobile,code-review}.md`
- `docs/README.md` (index) · `AGENTS.md` §10
