# Code Review Standards

> Canonical context: [`../../AGENTS.md`](../../AGENTS.md). Automation: `/code-review` and the `code-reviewer` skill.
> Goal: correctness + security + **preserving the guardrails** + maintainability.

## PR rules
- [ ] Small, focused PR; **Conventional Commits** (`feat/fix/chore/docs/refactor/test`).
- [ ] CI green: `lint` + `typecheck` + `build`. No merge on red.
- [ ] **Feature doc updated** — see [features](../features/README.md). Every meaningful development
  appends a dated entry to the matching feature doc's "Geliştirmeler (timeline)" section.
- [ ] No out-of-scope work added "by the way" (phase discipline §10) → backlog.

## Reviewer checklist
**Correctness**
- [ ] Logic does what's claimed; edge cases (empty/null/bounds) handled; error paths clear.

**Security**
- [ ] AuthZ (Guard/Policy) + tenancy (user_id/org_id) + RLS in place; client not trusted.
- [ ] No injection (parameterized/Drizzle); secrets/PII don't leak to logs or the LLM; input validated with Zod.
- [ ] **No raw SQL/DB/internal errors or stack traces returned to the client** → generic localized `ApiError` + server-side log.

**Guardrails (§4 — non-negotiable)**
- [ ] LLM doesn't generate official info (editorial content + data card) · photo categorizes-not-solves.
- [ ] Coin non-monetary/capped · append-only ledger · no coin in the chat zone · reward ≤ action value.
- [ ] No ongoing AI on free · AI→teacher trust line (raw confessions don't go) · KVKK (PII-min, transfer disclosure).
- [ ] Data model org_id/coach-ready (Phase 2/3 won't break).

**Performance**
- [ ] BE: no N+1, pagination present, proper indexes, heavy work on the queue.
- [ ] FE: no waterfalls (`Promise.all`/Suspense), bundle not bloated (dynamic import/avoid barrel), no needless re-renders.

**Engineering principles** (§[engineering-principles](./engineering-principles.md))
- [ ] SOLID/DRY/KISS/YAGNI; no premature abstraction.
- [ ] No hardcoded tunables / **no silent fallbacks** (explicit + justified + logged if any).
- [ ] Edge/negative cases handled, without excessive defensive programming (validate at the boundary, trust inside).
- [ ] **No business logic/calculations on FE/mobile** — backend computes; messages come localized from the backend.

**Quality & design**
- [ ] DESIGN tokens (no magic numbers) · shared types/schemas used (no copy-paste).
- [ ] **Loading states use page skeletons** (`*-content-skeleton.tsx`) with global `.mentor-skeleton-shimmer` /
  `.mentor-skeleton-enter` only — no spinners or `animate-pulse` for content placeholders.
- [ ] Critical paths tested; names clear; **dead code removed for the touched scope**; no stray TODO/FIXME.

## Blocking findings (prevent merge)
Guardrail violation · security hole · red CI · schema change without a migration · committed secret · missing devnote.

## Flow
1. Developer self-review + `/code-review` (or the `code-reviewer` skill).
2. At least one approval; squash merge if no blocking findings.
3. Sensitive areas (money/coin/payment/auth) → extra care + audit.
