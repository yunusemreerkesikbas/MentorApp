# AI

> AI coach: context injection (not training), LLM + pgvector RAG, photo→subject categorize, mood
> reflection, ghost narration, vision board note. Module: `modules/ai`. Workstream: W3.
> Roadmap: MVP; Phase 2 adds multi-turn, streaming, memory profile, topic-level vision.

## Overview

The AI module is the intelligence layer — single LLM model with personalization via structured context
injection (no training/no fine-tuning). It provides premium-gated chat (RAG-grounded + sourced),
photo→subject classification, mood reflection, ghost (geçmiş-ben) narration, and vision board
motivation notes. Cost is controlled by premium gating + coin spending + rate-limits + daily caps.

## Architecture (key decisions)

- **Context injection, not training:** single model; personalization = injecting the user's structured
  summary into the prompt on every reply. `ContextBuilder` builds `CoachContext` from identity + content
  + coaching + mood — PII-free (§4 #6).
- **§4 #1 (hardest guardrail):** the system prompt FORBIDS generating official info (dates/process/
  placement) and redirects to `/bilgi` + data card — no hallucination. RAG grounds answers in verified
  `info_articles`; if no relevant source found → "doğrulanmış içerik bulamadım → /bilgi" (no fabrication).
- **LlmPort** (domain port): `FakeLlmAdapter` (dev default, deterministic) + `OpenAiLlmAdapter`
  (real, fetch-based, no new dependency). Selected by `AI_PROVIDER` env.
- **VisionPort** (module-local): `FakeVisionAdapter` + `GeminiVisionAdapter` — photo→subject classify only
  (§4 #2 — never solves).
- **StoragePort** (shared): `FakeStorageAdapter` + `R2StorageAdapter` — signed upload URL flow.
- **RAG:** async embedding pipeline (`ArticlePublished` → job → `LlmPort.embed` → `ContentService.
  setArticleEmbedding`), retrieval via pgvector cosine similarity (≤0.6 threshold). Content-owned
  embedding (§3 — AI computes, content stores/searches).
- **Cost (§7):** `ai_usage` table (model + tokens + estimated `cost_micros`). Premium daily rate-limit
  (`ai.chat.daily_limit`, default 30). Coin spend = separate free daily coin allowance.
- **Flags:** `ai.enabled` (global kill-switch → 404) + `economy.enabled` (coin path).

## Tutorials / Guides

```bash
# Dev defaults: AI_PROVIDER=fake, VISION_PROVIDER=fake, STORAGE_PROVIDER=fake
pnpm dev

# Premium user — chat:
POST /v1/coach/chat { "message": "Nasıl çalışmalıyım?" }

# Access probe (tells mode: PREMIUM|COIN|NONE):
GET /v1/coach/access

# Mood reflection (premium, idempotent per day):
POST /v1/coach/mood-reflection

# Ghost narration (premium, cached per latest attempt):
POST /v1/coach/ghost-narration

# Vision board note (premium, cached):
POST /v1/coach/vision-note

# Photo upload + categorize (premium):
GET  /v1/coach/photo-access
POST /v1/mock-exams/photo-upload-url
POST /v1/mock-exams/{id}/categorize-photo

# Admin: backfill embeddings (SUPER_ADMIN):
POST /v1/admin/ai/reembed

# Run tests:
pnpm --filter @mentor/api test -- --grep "ai"
```

## API

| Endpoint | Purpose |
|---|---|
| `POST /v1/coach/chat` | AI coach chat (single-turn, RAG-grounded) |
| `GET /v1/coach/access` | Access probe (PREMIUM/COIN/NONE) |
| `POST /v1/coach/mood-reflection` | Premium mood AI reflection |
| `POST /v1/coach/ghost-narration` | Premium ghost AI narration |
| `POST /v1/coach/vision-note` | Premium vision board AI note |
| `GET /v1/coach/photo-access` | Photo categorize access (upload URL) |
| `POST /v1/admin/ai/reembed` | Backfill article embeddings (SUPER_ADMIN) |

## Geliştirmeler (timeline)

- **Slice 1 — Lean chat** — premium-gated, single-turn, `LlmPort` (fake/OpenAI), §4 #1 refusal,
  `ai_usage` metering, premium daily rate-limit. *(0030.)*
- **RAG grounding** — async embedding pipeline (`ArticlePublished` → job), pgvector cosine retrieval,
  source chips in web koç UI, admin backfill endpoint. Content-owned embedding. *(0043.)*
- **Coin → AI chat spend** — `EconomyService.spend()`, free daily coin allowance, LLM-failure refund.
  *(0045.)*
- **Photo → subject categorize** — `VisionPort` + `StoragePort` + `FakeVisionAdapter`/`GeminiVisionAdapter`,
  premium monthly cap, subject-level only (§4 #2). *(0047.)*
- **Mood AI-adaptive** — premium mood reflection (PII-free grounding: exam + countdown + coarse mood),
  daily idempotent cache, coach chat mood-aware. *(0048.)*
- **Ghost AI narration** — premium AI narration on latest mock-exam attempt, rule-based comparison for
  all users. *(0049.)*
- **Koç hub + chat split** — `/koc` hub (greeting, shortcut cards, session recent pills, start/continue CTAs) and `/koc/chat` (back header, transcript, composer). `CoachSessionProvider` in `koc/layout.tsx` persists messages + recent topics in `sessionStorage` (`mentor:coach-session:v1`) for the browser tab only — no backend history. Hub shortcuts and panel coach CTA deep-link via `?seed=` (composer pre-fill). Gate blocks both routes when `canChat=false`. Puhu avatar on coach bubbles; Encouraging Puhu on gate. *(2026-06-30.)*
- **Puhu coach bubble** — reusable `PuhuCoachBubble` (`apps/web/src/components/puhu-coach-bubble.tsx`): white speech card + tail (`.mentor-coach-bubble`), dismiss X, optional bounce; wired on `/koc` gate (reason-specific copy) and hub welcome. *(2026-06-30.)*

## Gotchas / Known issues

- **No RAG in Slice 1** — the coach refuses official-info questions until RAG retrieval lands.
- **§4 #1 preserved:** prompt grounds ONLY on retrieved verified articles; critical dates still go to
  the data card. No relevant source → no fabrication.
- **Content-owned embedding** — AI never touches `info_articles`; it computes + calls ContentService.
- **No vector index yet** — seq scan is exact + fast at MVP article counts; HNSW/ivfflat = backlog.
- **Fake embed is lexical** (token buckets) — semantically rough but deterministic for reliable tests.
- **Photo upload URL gate** — was initially un-gated; fixed in review: `PhotoAccessService.assertCanCategorize`
  runs before `createUploadUrl`.
- **Vision runs synchronously** — latency + cost exposure under load. JobQueuePort + poll/webhook = backlog.
- **AI never writes coaching tables** — it calls `MoodService.setTodayAiReflection`,
  `MockExamService.setLatestGhostNarration`, `VisionService.setAiNote` (workstreams §2).
- **W2↔W3 seam:** mood reflection (0048) and ghost narration (0049) cross W2 (coaching domain logic)
  and W3 (AI LLM call). See also [coaching.md](./coaching.md) for the coaching side.
- **Rate-limit window** is rolling 24h (`now − 24h`), not calendar-day.

## Related

- Seam: [coaching.md](./coaching.md) (mood, ghost, vision), [content.md](./content.md) (RAG source),
  [economy.md](./economy.md) (coin spend), [payments.md](./payments.md) (PremiumGuard)
- Web: [i18n.md](./i18n.md) (koc namespace)
- Status: [core/mvp-status.md](../core/mvp-status.md) (W3)
