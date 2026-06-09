# 0009 — Workstreams (Parallel MVP Tracks)

> Date: 2026-06-10 · Scope: documentation / process · Related: docs/workstreams.md

## What was done
- Added [`docs/workstreams.md`](../workstreams.md): the MVP split into **7 tracks** (W0 identity →
  W1 content · W2 coaching · W3 ai · W4 payments · W5 notifications+queue · W6 admin+light-economy)
  with **exclusive ownership boundaries** (api module + web route folders per track).
- Rules for shared surfaces (same worktree): `app.module.ts` one-line imports · `schema.ts` +
  `error-code.ts` + locales + `@mentor/types` **append-only** · migrations sequential/forward-only ·
  platform code (`common/**`, packages) minimal coordinated changes.
- Sequencing: **W0 identity is solo and blocking**; then batch A (W1/W2/W4/W5 parallel) → batch B (W3/W6).
- Wired into AGENTS.md §9 and CLAUDE.md ("read workstreams before picking up work").

## How to use (usage)
- An agent picking up work: open `docs/workstreams.md` → claim a track → stay inside its "owns
  exclusively" paths → consume other modules only via public services/ports/events (stub if absent).

## Gotchas
- Module-specific error codes get a prefix (`AUTH_…`, `PAYMENT_…`) to keep `errors.json` append-only.
- W5 owns the only `JobQueuePort` implementation; other tracks just enqueue.

## Related files & decisions
- `docs/workstreams.md` · `AGENTS.md` §9 · `CLAUDE.md`
