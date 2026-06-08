# 0004 — Engineering Principles

> Date: 2026-06-07 · Scope: standards / engineering rules · Related: AGENTS.md §10

## What was done
- Added [`docs/standards/engineering-principles.md`](../standards/engineering-principles.md) — the cross-cutting
  *how-we-write-code* rules above the per-stack standards:
  - SOLID / DRY / KISS / YAGNI, composition over inheritance.
  - **No hardcoding / no silent fallbacks** (tunables → config registry; fallbacks explicit+justified+logged; fail-fast).
  - **Balanced robustness:** handle edge/negative cases, but validate once at the boundary — no over-defensive code.
  - **Logic is backend-only:** web+mobile only shape/display computed data (single brain, parity).
  - **User-facing messages come localized from the backend** (`message` + stable `code`); clients display directly.
  - **Definition of Done** incl. **dead-code cleanup**, tests, CI green, no stray TODO, devnote.
- Wired into: AGENTS.md §10, docs/README, conventions.md, code-review.md checklist, and frontend/mobile/api standards
  (logic-backend-only + localized-messages bullets; api.md §4b).
- **Decided:** localization model = backend returns localized `message` + stable `code` (per `Accept-Language`);
  clients display `message` directly. Added operability rules: **migrations forward-only**, **observability**
  (correlation id + structured logs + no PII/secrets), **feature flags** for phased/risky rollout (also in backend.md).

## How to use (usage)
- Read this before any feature work; review enforces it (code-review.md).
- Backend computes & localizes; FE/mobile render. New API errors/messages → localized `message` + `code`.

## Gotchas
- "No fallback" ≠ "no defaults": tunable defaults belong in the **config registry**, not inline literals.
  A real fallback is allowed only when justified, and must be explicit + logged (never silent).
- Static UI chrome copy stays client-side (Turkish in MVP); only **dynamic/business/validation** messages are backend-owned.

## Related files & decisions
- `docs/standards/engineering-principles.md` · `code-review.md` · `frontend.md` · `mobile.md` · `api.md`
