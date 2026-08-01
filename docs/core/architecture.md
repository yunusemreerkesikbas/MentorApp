# Architecture

> Summary + pointers. Full rationale: [roadmap §8](../../sinav-kocluk-roadmap.md) (Turkish). Guide: [AGENTS.md](../../AGENTS.md).

## Style: Modular Monolith + Pragmatic Clean + DDD
- **Dependency rule:** outside-in; the domain knows no framework; infrastructure (Neon/iyzico/LLM/R2)
  is outermost and **plugs into** the inside (Ports & Adapters).
- **Pragmatic Clean:** the dependency rule is the same everywhere, but layer depth scales with the work.
  Simple CRUD → controller+service+repo. Critical domain → domain/application/infrastructure/presentation.

## Module map (bounded contexts)
```
identity · coaching · ai · content · payments · notifications · admin   (MVP)
economy · forum · community                                            (Phase 2)
marketplace                                                            (Phase 3)
```
Modules never touch each other's tables → public interface / domain event.

## Event-driven backbone
Cross-module triggers are not a synchronous chain but loosely coupled via **domain events**. Example:
```
PostVerified (forum) →
  economy: coin PENDING→CONFIRMED (ledger)
  ai:      snapshot to C-layer + embedding queue
  community: update leaderboard (Phase 2: Redis)
  notifications: push to author
```
Forum doesn't know its listeners → a new reaction = a new listener, without touching existing code.
Internally NestJS `EventEmitter`; moves to a queue if modules split out (same code).

## AI coach architecture
- **Context injection, not training.** A deterministic `CoachTurnPlanner` selects intent, tone,
  at most three verified facts and at most one backend action; the selected model only writes the
  visible mentor response.
- **Flow:** raw event → Postgres (RLS) → rule-engine summary/metrics (cheap) → **Context Builder**
  (PII-minimal structured summary) → LLM (no-training) [+ pgvector RAG knowledge center].
- **Cross-thread memory is explicit and structured.** `coach_profiles` stores consent and tone
  preferences; `coach_memory_facts` stores only allowlisted normalized facts. Chat-derived facts
  reference their source message and cascade with it. Legacy `coach_memory` remains inactive and
  exists only for backward compatibility/deletion.
- **Module seam:** AI never queries coaching tables. `CoachEvidenceService` exposes aggregate,
  PII-minimal evidence; approved mutations call Coaching public services. Task-completion events
  close the action feedback loop without a cross-module table write.
- **Provider portability:** the persona and decision layer are provider-neutral behind `LlmPort`.
  Every selected model/provider must pass the same streaming, marker-hygiene, safety and persona evals.
- **Cost (§7):** hybrid (rule engine handles daily touch ~0) + model tiering + cache + rate-limit.
  Free = no LLM; premium = fair-use.

## Single API + realtime
- **REST `/v1` + OpenAPI** + Zod validation (`@mentor/validation`). OpenAPI → orval → `@mentor/api-client`.
- **WebSocket Gateway** (Socket.io) presence/neighborhood/live room — **Phase 2**; Redis adapter at scale.

## Cost & security shield
Cloudflare edge rate-limit + Turnstile (MVP) · Neon max-CU + budget alert · idempotent webhook ·
admin behind Cloudflare Access · card data at iyzico (PCI not ours).

## Diagram (high level)
```
[ Cloudflare edge: DNS/SSL/CDN/WAF/RateLimit/Turnstile/Images/R2/Access ]
            │
   ┌────────┴─────────┐
[ web ]            [ admin ]            (Next.js)        ── (Phase 2) [ mobile ] [ panel ]
   │  REST /v1 (OpenAPI, @mentor/api-client)
   ▼
[ apps/api — NestJS modular monolith ]
   ├─ modules (identity/coaching/ai/content/payments/notifications/admin ...)
   ├─ shared/ports → adapters (OpenAI/Gemini/iyzico/R2/Postmark)
   ├─ JobQueuePort: Render Cron + jobs table (MVP) → BullMQ+Redis (Phase 2)
   └─ Drizzle (pg Pool) → [ Postgres + pgvector (RLS via SET LOCAL) ]   (local docker / Neon)
```
