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
- **Koç hub generated hero** — `/koc` now uses the generated `koc-hero.png` as the main app-poster visual, with only a greeting overlay and start/continue CTAs. Dense shortcut-card grid and prompt chips were removed. Usage unchanged (`/koc`, `/koc/chat?seed=...`). Gotcha: chat route and access gate were intentionally left unchanged. Files: `koc-hub.tsx`, `koc-content-skeleton.tsx`. *(2026-07-03.)*
- **Koç seans-farkında (2026-07-09)** — roadmap §258/§259 payoff'unun context katmanı: `CoachContext`'e
  PII-free `recentSessions` özeti eklendi (son 7 gün seans/odak + distinct konular + son `struggle_note`).
  `ContextBuilder` artık coaching'in `SessionService.getRecentSummary`'sini de okuyor (mood ile aynı
  defensive `.catch(() => null)` deseni). Özet hem koç sohbetini (`buildSystemPrompt` → `ChatService`)
  hem mood refleksiyonunu (`buildMoodReflectionPrompt` → `MoodReflectionService`) seans-farkında yapar;
  `formatRecentSessionsLine` tek yerde biçimlendirir, aktivite yoksa satır düşer. Yeni endpoint/gating/
  migration yok — koç sohbeti zaten premium/coin ile gate'li. **Guardrail (§4 #6):** agregat sayı +
  kullanıcının kendi konu/notu, PII yok. **Kapsam dışı:** seans başına premium AI yansıması (ayrı
  endpoint + migration), `ai_usage` feature-label cap (0048). Dosyalar: `ai.constants.ts`,
  `context-builder.service.ts`, `context-builder.service.spec.ts`. Seam: [coaching.md](./coaching.md).
- **Koç plan-farkında (2026-07-11)** — roadmap §259 devamı: `CoachContext.todayPlan` bugünkü plan
  özetini taşır (`PlanService.getTodaySummary` seam). `formatTodayPlanLine` koç sohbeti, mood ve
  seans yansıması prompt'larına "Bugünün planı: X/Y tamam; kalan: …" satırı ekler; görev yoksa düşer.
  Yeni endpoint/migration yok. **Kapsam dışı:** AI plan revizyonu, FE. Dosyalar: `ai.constants.ts`,
  `context-builder.service.ts`, `context-builder.service.spec.ts`. Seam: [coaching.md](./coaching.md).
- **Seans sonrası premium AI yansıması (2026-07-09)** — roadmap §259: mikro check-in `Kaydet` sonrası
  premium kullanıcıya seansa özel 2–3 cümlelik AI yorumu. `POST /v1/coach/session-reflection`
  `{ sessionId }` — `AI_ENABLED` + `isPremium`; `sessionMood` yoksa 400; satır cache
  (`study_sessions.ai_reflection` / `ai_model` / `ai_reflected_at`, migration `0039_fair_jazinda`);
  feedback değişince cache invalidate. Free: sessiz (AI kutusu yok). FE: done ekranı access=PREMIUM
  ise çağırır → Puhu bubble. Dosyalar: `session-reflection.service.ts`, `ai-session.controller.ts`,
  `session.service.ts` (`setAiReflection`/`getById`), `session-done-state.tsx`, `coach.ts`,
  `messages/{tr,en}.json`. Seam: [coaching.md](./coaching.md).
- **Headroom context compression (2026-07-10)** — optional [Headroom](https://github.com/headroomlabs-ai/headroom).
  **Mod B (koç API):** `ContextCompressionPort` + sidecar; RAG verbatim (§4 #1); `ai.compression.enabled`
  (default off). **Mod A (geliştirme):** `pnpm headroom:wrap cursor|claude|codex` — bkz.
  [dev/headroom.md](../dev/headroom.md). Dosyalar: `prompt-compression.service.ts`,
  `docker/headroom/`, `scripts/headroom-dev.mjs`.

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
