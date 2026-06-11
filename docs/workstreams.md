# Workstreams — Parallel MVP Development

> Multiple agents develop in parallel (same worktree). This doc splits the MVP into **tracks with
> exclusive ownership boundaries** so agents don't step on each other. Read before picking up work.
> Step plans per track still follow the standards (`docs/standards/*`) + devnote rule.

## 0. Sequencing — what must come first

```
DONE  Base infrastructure (db/errors/i18n/logging/health/tests)
DONE  W0 identity (auth + RLS + web auth screens — devnote 0010)
DONE  W4 payments (PaymentsPort fake/iyzico, entitlement+PremiumGuard, /abonelik — devnote 0015)
PARTIAL W1 content (exam calendar Slice 1 — devnote 0016; knowledge center Slice 2 — devnote 0017) · W2 coaching (daily loop + panel — devnotes 0014, 0013)
NEXT  W5 notifications · then batch B: W3 ai (PremiumGuard ready) · W6 admin
```
`identity` is the prerequisite for everything (auth guards, RequestContext.userId, RLS policies,
users/orgs tables). Do it solo; parallelism starts after.

## 1. Tracks & exclusive ownership

| Track | Scope (MVP steps) | Owns exclusively |
|---|---|---|
| **W0 — Identity (foundation)** | auth (JWT+refresh, argon2), users/orgs/roles, RLS policies, guards, onboarding API | `modules/identity/**` · `web: (auth) routes` |
| **W1 — Content** | knowledge center A-layer (InfoArticle + trust metadata), exam calendar, pgvector embeddings | `modules/content/**` · `web: bilgi/SEO pages` |
| **W2 — Coaching** | plan + countdown, Pomodoro/sessions, streak, mock-exam analysis (net), ghost, vision board, mood check-in (rule-based) | `modules/coaching/**` · `web: app screens (plan/seans/analiz)` |
| **W3 — AI** | Context Builder, memory profile, LLM/RAG orchestration, AI chat/comments, photo→categorize | `modules/ai/**` · `web: koç/chat UI` |
| **W4 — Payments** | iyzico subscription/trial, idempotent webhook, entitlement service | `modules/payments/**` · `web: abonelik screens` |
| **W5 — Notifications + Queue** | JobQueuePort cron adapter/runner, web push, email (Postmark), scheduled jobs | `modules/notifications/**` · queue adapter |
| **W6 — Admin** | admin module (content editor, users, refund, metrics, flags, audit) + **light economy** (earned AI right: invite/quest, coin ledger) · **STAFF role assignment endpoint + audit** (entitlement mechanism already live in W4 — until then assignment is manual SQL, see devnote 0015) | `modules/admin/**`, `modules/economy/**` · `apps/admin/**` |

**Cross-track dependencies (consume via contracts, don't block):**
- W3 needs W1 (RAG source) + W2 (behavior data) + W4 (entitlement) → starts against **ports/stubs**, wires real impls when merged.
- W6 admin edits W1 content + views W4 payments → consumes their **public services**; stub until available.
- W5 is consumed by all via `JobQueuePort` (already defined) — others enqueue, only W5 implements the runner.

## 2. Shared surfaces — touch rules

Same worktree → conflicts are rare but these files are shared. Rules:

| Shared surface | Rule |
|---|---|
| `app.module.ts` | add your module import — **one line, alphabetical** |
| `database/schema.ts` | **append-only**, your tables in a clearly commented block. (If it grows painful, split to per-module files — coordinated change.) |
| `drizzle/` migrations | **sequential**: generate your migration only when your schema change is final; never edit applied migrations (forward-only) |
| `common/**`, `database/{drizzle,rls,module}`, `packages/*` | platform code — change only if your track truly needs it; keep the change minimal and generic |
| `common/errors/error-code.ts` + `i18n/locales/*/errors.json` | append-only; module-specific codes prefixed (e.g. `AUTH_…`, `PAYMENT_…`) |
| `@mentor/types`, `@mentor/validation` | append-only; only genuinely shared contracts (feature types stay in your module) |
| `docs/standards/api.md` service catalog | update your module's row/status when you ship endpoints |
| `docs/devnotes/` | every track adds its own `NNNN-…` (next free number) |

**Web app routes:** each track owns its route folder under `apps/web/src/app/` (e.g. `(auth)`, `bilgi`,
`(app)/plan|seans|analiz`, `(app)/koc`, `(app)/abonelik`). Shared layout/nav changes = coordinated.
`apps/admin/**` belongs wholly to W6.

## 3. Working agreement
- One track = one agent at a time. Don't write inside another track's `modules/<x>/**`.
- Need something from another module? Use its **public service/port or a domain event** — never its tables (§AGENTS 2). If the contract doesn't exist yet, define the interface in your module and stub it.
- Before starting a track: read its roadmap sections + relevant standards; plan; after finishing: devnote + update the api.md catalog.
- Quality gates per track: typecheck/lint/build/test green; review checklist (`docs/standards/code-review.md`).

## 4. Suggested execution order
1. **W0 identity** (solo, blocking)
2. Parallel batch A: **W1 content** + **W2 coaching** + **W4 payments** + **W5 notifications** (mutually independent)
3. Parallel batch B: **W3 ai** (needs W1/W2/W4 contracts) + **W6 admin** (needs W0 roles; stubs others)
