# Engineering Principles (cross-cutting)

> Canonical context: [`../../AGENTS.md`](../../AGENTS.md). Applies to **all** surfaces (api/web/admin/mobile).
> Binding; checked in review ([code-review.md](./code-review.md)). These are the *how-we-write-code* rules
> that sit above the per-stack standards.

## 1. Design principles (mandatory mindset)
- **Clean Code:** readable > clever. Small, single-purpose functions; intention-revealing names; comment the **why**.
- **SOLID:** one responsibility per unit; depend on abstractions (**ports**), not concretions; small, focused
  interfaces; composition over inheritance.
- **DRY:** one source of truth (`@mentor/types`, `@mentor/validation`, config registry, `@mentor/ui`). Extract on
  the *third* real repetition — not prematurely (a wrong abstraction is worse than duplication).
- **KISS:** the simplest thing that works. No cleverness without a clear payoff.
- **YAGNI:** build for the **current phase** (§10). No speculative abstractions/flags/layers (ties to AGENTS §5:
  add a pattern only when you feel the pain).

## 2. No hardcoding / no needless fallbacks
- **Tunable values** (caps, prices, thresholds, rate-limits) → central **config registry** (§9), never inline literals.
- **True invariants** (e.g. net divisor) → named constants in `@mentor/core`/module, not scattered magic numbers.
- **Fallbacks only when genuinely required.** Never a **silent** default that masks missing/invalid data
  (`value ?? somethingMadeUp` hiding a bug). A fallback must be **explicit, justified (comment), and logged**.
  Prefer **fail-fast at the boundary** over quietly papering over bad state.

## 3. Balanced robustness (edge cases, not paranoia)
- Design for the **unhappy path too:** empty/null, boundaries, concurrency, partial failure, timeout,
  unauthorized, not-found, duplicate (idempotency). Don't ship happy-path-only.
- **But avoid excessive defensive programming:** validate **once at the boundary** (Zod DTO, guards), then
  **trust** the validated data inside. Don't re-assert the same invariant in every inner function.
- **Fail loud in dev, degrade gracefully in prod** (typed error → `ApiError`). No empty `catch`.

## 4. Where logic lives (web + mobile share one brain)
- **All business logic & calculations are backend-only:** net/score, coin/XP, eligibility, pricing, ranking, etc.
  The API returns **computed, ready-to-render** data.
- **Frontend/mobile only shape & display** returned data (formatting, layout, interaction). They **never recompute**
  business rules → guarantees web/mobile parity and a single source of truth.
- Genuinely cross-surface, **non-authoritative** pure helpers (e.g. display formatting, exam-agnostic config) may
  live in `@mentor/core`; authoritative computation stays in the api.

## 5. User-facing messages = backend, localized
- The backend returns user-facing messages **already localized** (per `Accept-Language`) as a human `message`
  **plus** a stable machine `code` (`ApiError` / success payload). **FE/mobile display `message` directly** — no
  hardcoded business/validation copy on the client.
- Validation messages also come localized from the backend (the Zod layer maps to localized strings).
- FE/mobile own **only static chrome copy** (labels, buttons, nav). MVP is single-language (Turkish); when
  multi-language arrives, the client gets its own i18n catalog for chrome — but **dynamic/business messages stay
  backend-owned**.

## 6. Definition of Done (a task/PR isn't complete until)
- [ ] Edge/negative cases handled (not just the happy path).
- [ ] No business logic on FE/mobile; user-facing messages come from the backend.
- [ ] No hardcoded tunables / silent fallbacks; no magic numbers (DESIGN tokens / config registry).
- [ ] **Dead code removed for the touched scope** — unused vars/imports/branches/files, no commented-out code.
- [ ] Tests for the logic (backend use-cases); CI green (lint/typecheck/build).
- [ ] No stray `TODO/FIXME` without a tracked reference.
- [ ] Docs updated (service catalog/OpenAPI if the API changed) + **devnote added**.

## 7. Other contracts (quick reference)
- **Errors:** typed; mapped to `ApiError` at the boundary; never swallowed. **Never surface raw SQL/DB/internal
  errors or stack traces to the user** → return a generic localized message + `code`, and log full detail server-side.
- **Time:** store UTC, format on display. **Money:** no float (minor units/`numeric`), string in the API.
- **Single source of truth:** types `@mentor/types` · validation `@mentor/validation` · tunables config registry · design `@mentor/ui`.
- **TODO/FIXME:** allowed only with a tracked reference; otherwise resolve before merge.

## 8. Operability
- **Migrations are forward-only:** never edit an applied/shipped migration → create a new one. Migrations are
  reviewed and reversible-by-design where feasible.
- **Observability:** every request carries a **correlation/request id**; logs are **structured**; **never log
  PII or secrets**; errors go to Sentry with context.
- **Feature flags:** phased/risky features ship behind a **config-registry flag** (gradual rollout + kill-switch).
  Ties to YAGNI + phase discipline (§10) — flag the rollout, don't fork the codebase.

## Localization model (decided)
Backend returns user-facing copy as a localized **`message`** (per `Accept-Language`) **+** a stable machine
**`code`**. Clients display `message` directly; `code` is for client-side branching only (never for client-built copy).
