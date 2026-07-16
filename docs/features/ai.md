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
- **VisionPort** (module-local): `FakeVisionAdapter` + `GeminiVisionAdapter` + `OpenAiVisionAdapter` — photo→subject/topic classify only
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

# Opt-in: four low-cost real OpenAI calls; reads apps/api/.env and never runs under pnpm test
pnpm --filter @mentor/api test:live:openai

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
| `POST /v1/coach/chat` | AI coach chat (multi-turn, RAG-grounded) |
| `POST /v1/coach/chat/stream` | Streaming chat (SSE over POST; delta → done/error) |
| `POST /v1/coach/conversations/:id/regenerate/stream` | Regenerate the last coach reply (SSE; same spend as a message) |
| `GET /v1/coach/conversations` | The user's chat threads, most-recently-active first |
| `GET /v1/coach/conversations/:id/messages` | One thread's paginated history |
| `DELETE /v1/coach/conversations/:id` | Delete one thread (messages cascade) |
| `PATCH /v1/coach/messages/:id/feedback` | Rate a coach reply (👍 1 / 👎 -1 / null) |
| `GET /v1/coach/memory` | Distilled PII-free memory profile (null until built) |
| `DELETE /v1/coach/memory` | Reset the memory profile (KVKK) |
| `GET /v1/coach/access` | Access probe (PREMIUM/COIN/NONE) |
| `POST /v1/coach/mood-reflection` | Premium mood AI reflection |
| `POST /v1/coach/daily-greeting` | Premium proactive daily greeting (cached per user+day) |
| `POST /v1/coach/plan-draft` | Premium 7-day plan draft PREVIEW (never persisted; user confirms via W2 bulk) |
| `POST /v1/coach/ghost-narration` | Premium ghost AI narration |
| `POST /v1/coach/vision-note` | Premium vision board AI note |
| `GET /v1/coach/photo-access` | Photo categorize access (upload URL) |
| `POST /v1/admin/ai/reembed` | Backfill article embeddings (SUPER_ADMIN) |
| `GET /v1/admin/metrics/ai` | LLM cost dashboard (window/model/top-spenders; SUPPORT+FINANCE) |
| `GET /v1/admin/metrics/coach-feedback` | Coach 👍/👎 satisfaction + recent 👎 replies (SUPPORT+FINANCE) |

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
- **Multi-turn + kalıcı sohbet geçmişi (2026-07-11)** — Faz 2 backlog'unun ilk kalemi: koç artık
  hafızalı. Yeni `coach_messages` tablosu (kullanıcı başına **tek rolling sohbet**, thread yok;
  migration `0044_silent_solo` + RLS self-or-service) user+coach mesajlarını persist eder (COACH
  satırında `sources` jsonb + `model`). `ChatService` her yanıttan önce son
  `CHAT_HISTORY_MAX_MESSAGES`(10) mesajı `LlmPort.complete({ history })`'ye enjekte eder (defensive
  — history yüklenemezse sohbet yine çalışır); persist yalnız **başarılı** yanıttan sonra (LLM
  hatası satır bırakmaz). Yeni endpoint'ler: `GET /v1/coach/messages` (paginated, auth-only) +
  `DELETE /v1/coach/messages` ("Yeni sohbet"). FE: `CoachSessionProvider` artık API'den hydrate olur
  (ilk 30 mesaj); `sessionStorage` yalnız recent-topic pill'leri taşır. Gating/coin/rate-limit
  akışı değişmedi (maliyet birimi = kullanıcı mesajı). Dosyalar: `schema.ts`,
  `coach-message.repository.ts`, `chat.service.ts`, `llm.port.ts`, `fake/openai-llm.adapter.ts`,
  `ai-chat.controller.ts`, `coach-session-context.tsx`, `coach-session-storage.ts`, `coach.ts` (web),
  `packages/types/ai.ts`.
- **Streaming yanıt — SSE (2026-07-11)** — `POST /v1/coach/chat/stream`: SSE over POST; ilk event
  header'lar yazılmadan **önce** beklenir (gating/rate-limit/coin hataları normal HTTP hatası olarak
  döner), sonra `{delta}` event'leri + tek terminal `{done}` (reply+sources) veya `{error}`.
  `LlmPort.completeStream` (fake: kelime kelime deterministik; OpenAI: `stream:true` +
  `stream_options.include_usage`). Orta-akış hata → coin refund (mevcut yol) + `error` event;
  persist yalnız stream tamamlanınca. FE: `streamCoachMessage` (`httpRaw` + ReadableStream parse,
  `res.body` yoksa blocking fallback); transcript'te koç balonu delta'larla büyür, hata durumunda
  parçalı balon kaldırılır (`coach.chat.stream_error`). Dosyalar: `llm.port.ts`, adapters,
  `chat.service.ts` (`replyStream`), `ai-chat.controller.ts`, `http.ts` (`httpRaw`), `coach.ts`,
  `koc-chat-shell.tsx`, `coach-session-context.tsx` (`updateMessage`/`removeMessage`).
- **Akıllı hub — kural tabanlı brief + öneri chip'leri (2026-07-11)** — `/koc` hub'ına LLM'siz
  günlük özet: `KocHubBrief` mevcut `GET /v1/coaching/today` + `GET /v1/coaching/analysis`
  verisinden "Bugünün planı: X/Y tamam · Seri: N gün" kartı (+ varsa backend-localized `nextFocus`
  mesajı) ve 2-3 bağlamsal öneri chip'i üretir; chip'ler mevcut `?seed=` deep-link'iyle composer'ı
  ön-doldurur. Her iki fetch defensive (analysis 400 = normal durum, kart sessizce küçülür).
  Backend değişikliği yok. Dosyalar: `koc-hub-brief.tsx`, `koc-hub.tsx`,
  `koc-content-skeleton.tsx`, `messages/{tr,en}.json`.

- **AI plan revizyonu — koç → görev önerisi (2026-07-11)** — roadmap §259 devamı: koç, somut görev
  önerdiğinde yanıtın sonuna tek satır `<<TASK{"title":"...","subject":"..."}>>` marker'ı ekler
  (system prompt kuralı). Backend `extractSuggestedTask` marker'ı parse+strip eder (bozuk JSON
  sessizce yok sayılır, marker yine temizlenir); stream'de `createTaskMarkerFilter` holdback'i
  marker'ın delta'lara SIZMAMASINI garanti eder (chunk sınırında bölünme dahil, spec'li).
  `CoachChatReplyDto.suggestedTask?` (append-only) hem `POST /chat` hem stream `done` event'inde.
  FE: koç balonu altında "Koçun önerisi" kartı + **Plana ekle** → mevcut `/plan?add=1&title=&subject=`
  prefill akışı (analiz kartıyla aynı yol). **Guardrail:** AI hiçbir plan tablosuna yazmaz — görev
  yalnız kullanıcı add-sheet'te onaylayınca kaydedilir. Fake adapter: mesajda "plan/görev" geçerse
  deterministik marker üretir. **Kapsam dışı:** öneri persist'i (kart ephemeral — reload'da düşer),
  çoklu öneri, OpenAI json modu. Dosyalar: `suggested-task.ts`(+spec), `ai.constants.ts`,
  `chat.service.ts`(+spec), `fake-llm.adapter.ts`, `packages/types/ai.ts`, `coach-transcript.tsx`,
  `koc-chat-shell.tsx`, `messages/{tr,en}.json`.

- **Dinamik provider seçimi (2026-07-11)** — chat ve vision artık env'den seçilebilir:
  `AI_PROVIDER=fake|openai|gemini`, `VISION_PROVIDER=fake|gemini|openai` — hangi provider + key
  girilirse o çalışır (tek OpenAI key ile chat+vision, ya da tek Gemini key ile chat+embed+vision).
  Yeni adapter'lar: `gemini-llm.adapter.ts` (complete + SSE stream + `gemini-embedding-001`
  embed, `outputDimensionality:1536` — pgvector uyumu boot'ta değil çağrıda hard-check) ve
  `openai-vision.adapter.ts` (`response_format: json_object`, gemini vision ile aynı 0.1 temp /
  128 token sınırları, `PHOTO_CLASSIFY_SYSTEM` paylaşımlı). Env validation her kombinasyon için
  key zorunluluğunu boot'ta doğrular. Port/servis/FE değişmedi — seam yeterliydi. Dosyalar:
  `env.validation.ts`, `gemini-llm.adapter.ts`, `openai-vision.adapter.ts`, `ai.module.ts`,
  `ai.constants.ts` (gemini fiyat güncellemesi), `.env.example`.

- **Yanıt feedback'i + öneri persist (2026-07-11)** — koç yanıtına 👍/👎 (`coach_messages.feedback`
  smallint: 1/-1/null) + Dilim 4 "Plana ekle" önerisi artık kalıcı (`coach_messages.suggested_task`
  jsonb — reload sonrası kart korunur). Migration `0046_curly_siren`. Yeni endpoint
  `PATCH /v1/coach/messages/:id/feedback` (yalnız kullanıcının kendi COACH satırı — RLS + role guard;
  yoksa 404). `appendExchange` artık `suggestedTask`'ı persist eder ve toplam mesaj sayısını döndürür
  (memory tetiği için). FE: `FeedbackRow` (optimistic, hata revert); hydrate feedback+suggestedTask'ı
  taşır. Dosyalar: `schema.ts`, `coach-message.repository.ts`, `chat.service.ts`, `ai-chat.controller.ts`,
  `packages/{types,validation}`, `coach-transcript.tsx`, `koc-chat-shell.tsx`, `coach-session-context.tsx`.
- **Memory profile (2026-07-11)** — koç oturumlar arası kullanıcıyı "tanır": yeni `coach_memory` tablosu
  (kullanıcı başına tek PII-free özet; RLS self-or-service; migration `0046_curly_siren`). Her
  `MEMORY_REFRESH_EVERY_N_MESSAGES`(10) mesajda `ChatService` `JobQueuePort.enqueue(AI_MEMORY_JOB)`
  (best-effort — chat'i bloklamaz); `RefreshMemoryHandler` son 40 mesajı `buildMemoryProfilePrompt`
  ile damıtır → `coach_memory.upsert` (messageCount aynıysa no-op, boş history no-op). `ContextBuilder`
  profili `CoachContext.memoryProfile`'a koyar; `buildSystemPrompt` BAĞLAM'a "Kullanıcı profili
  (geçmiş sohbetlerden): …" satırı ekler. Endpoint'ler: `GET /v1/coach/memory` + `DELETE`;
  "Yeni sohbet" (`clearMessages`) profili de siler. FE: hub'da `CoachMemoryCard` (özet + "Sıfırla",
  profil yoksa görünmez). **Guardrail (§4 #6):** damıtma prompt'u isim/e-posta/iletişim yasaklar;
  kullanıcı DELETE ile sıfırlar. Dosyalar: `coach-memory.repository.ts`, `refresh-memory.handler.ts`,
  `ai-job.registrar.ts`, `ai.constants.ts`, `context-builder.service.ts`, `chat.service.ts`,
  `coach-memory-card.tsx`, `messages/{tr,en}.json`.
- **Seans yansıması → plan önerisi (2026-07-12)** — roadmap §259: premium `POST /v1/coach/session-reflection`
  artık koç Dilim 4 ile aynı `<<TASK{...}>>` marker'ını destekler. `extractSuggestedTask` strip+parse;
  `SessionReflectionDto.suggestedTask?`; cache `study_sessions.ai_suggested_task` jsonb (migration
  `0047_supreme_eternals`); feedback değişince reflection+task birlikte temizlenir. FE: done ekranında
  shared `SuggestedTaskCard` → `/plan?add=1` prefill (AI plan tablosuna yazmaz). Eski cache (task null)
  → kart yok, regenerate yok. **Kapsam dışı:** Free rule-based öneri, çoklu öneri, otomatik plan yazımı.
  Dosyalar: `ai.constants.ts` (`buildSessionReflectionPrompt`), `session-reflection.service.ts`(+spec),
  `session.service.ts`, `schema.ts`, `packages/types/{ai,coaching}.ts`, `suggested-task-card.tsx`,
  `session-done-state.tsx`, `coach-transcript.tsx`. Seam: [coaching.md](./coaching.md).
  Design: [`plans/2026-07-12-seans-plan-suggestion-design.md`](../plans/2026-07-12-seans-plan-suggestion-design.md).

- **AI maliyet görünürlüğü — admin (2026-07-13)** — §7 KPI: `ai_usage` meteri artık admin panelinde.
  `GET /v1/admin/metrics/ai` (SUPPORT+FINANCE) rolling pencere totalleri (son 24s/7g/30g maliyet+çağrı
  +token) + model bazlı kırılım (30g) + en çok harcayan 10 kullanıcı (30g; admin-only email/isim
  JOIN). `AiUsageRepository`'ye 3 agregasyon (`windowSince`/`byModelSince`/`topSpendersSince`,
  SERVICE ctx); `AiCostStatsService` (AiModule export eder; admin.module AiModule import eder — döngü
  yok). Maliyet micro-USD saklanır, admin UI USD'ye formatlar. FE: `apps/admin` `AiCostCards.tsx`
  (Bootstrap/Duralux deseni; `/admin/metrics` `MetricsCards` aynası) dashboard'a eklendi. **Kapsam
  dışı:** özellik-bazlı kırılım (Dilim 10'da eklendi), grafik/zaman
  serisi, CSV export. Dosyalar: `ai-usage.repository.ts`, `ai-cost-stats.service.ts`(+spec),
  `admin-metrics.controller.ts`, `admin.module.ts`, `ai.module.ts`, `packages/types/ai.ts`,
  `apps/admin/src/{lib/types.ts,app/AiCostCards.tsx,app/page.tsx}`.

- **Koç feedback raporu — admin (2026-07-13)** — Dilim 6'daki 👍/👎 sinyali artık ölü veri değil:
  `GET /v1/admin/metrics/coach-feedback` (SUPPORT+FINANCE) tüm-zaman memnuniyet oranı
  (`up/(up+down)`, oy yoksa null) + son 20 👎 yanıtı **sorusuyla birlikte** listeler.
  `CoachMessageRepository`'ye 2 SERVICE-ctx metot: `feedbackCounts` (`count(*) FILTER`) ve
  `listDownrated` (korelasyonlu subquery ile önceki USER mesajını eşler — `alias(coachMessages)`).
  `CoachFeedbackStatsService` (AiModule export; admin.module zaten AiModule import ediyor).
  FE: `apps/admin` `CoachFeedbackCards.tsx` (AiCostCards deseni) dashboard'a eklendi. **Guardrail:**
  koç mesaj metni davranışsal serbest metin — admin-only görünür (top-spender email'i gibi; mevcut
  KVKK gotcha kapsıyor). **Kapsam dışı:** feedback'i prompt'a geri besleme, zaman serisi, 👍 listesi.
  Dosyalar: `coach-message.repository.ts`, `coach-feedback-stats.service.ts`(+spec),
  `admin-metrics.controller.ts`, `ai.module.ts`, `packages/types/ai.ts`,
  `apps/admin/src/{lib/types.ts,app/CoachFeedbackCards.tsx,app/page.tsx}`.

- **Özellik-bazlı AI maliyet kırılımı (2026-07-13)** — Dilim 8'in tamamlayıcısı: `ai_usage` +=
  `feature text` (migration `0048_chemical_lady_mastermind`, nullable — eski satırlar panelde
  "other"). `AiUsageFeature` sabiti (chat/vision/mood/ghost/vision_note/session_reflection/
  weekly_review/memory); 8 `usage.append` çağrısı özelliğiyle etiketlenir. **Memory metering açığı
  kapatıldı:** `RefreshMemoryHandler` artık `usage.append(feature=memory)` yazıyor (önce ölçülmüyordu).
  `AiUsageRepository.byFeatureSince` + `AiCostStatsService` payload'ına `byFeature`; admin
  `AiCostCards.tsx` "Özellik bazlı (30 gün)" tablosu (slug→TR etiket sözlüğü). Dosyalar: `schema.ts`,
  `ai.constants.ts`, `ai-usage.repository.ts`, `ai-cost-stats.service.ts`(+spec), 8 servis/handler,
  `refresh-memory.handler.ts`(+spec), `packages/types/ai.ts`, `apps/admin/src/{lib/types.ts,app/AiCostCards.tsx}`.

- **AI bütçe koruyucusu (2026-07-14)** — §7 kaçak harcama savunması: aylık AI harcaması admin config'li
  cap'i (`ai.budget.monthly_cap_usd_cents`, 0 = sınırsız) geçince tüm LLM çağrıları 503
  `AI_BUDGET_EXCEEDED` ile bloklanır; takvim ayı dönünce/cap yükseltilince otomatik toparlanır (yumuşak
  guard, kalıcı flag flip yok). `AiBudgetGuard` (yeni): takvim-ayı MTD harcamayı `windowSince`'den
  ~30s cache'ler (per-request agregasyon yok, per-instance cache). `assertWithinBudget()` 7 LLM
  giriş noktasında **billable çağrıdan hemen önce** (cache isabetleri/idempotent retry ücretsiz geçer);
  memory job throw yerine erken-return (retry fırtınası yok). Gate probe'ları
  (`coach-access`/`photo-access`) budget aşılıysa `canChat/canCategorize=false` + reason döner (UI
  "kullanılamıyor"). Admin: `/admin/metrics/ai` payload'ına `budget`; `AiCostCards` üstünde banner
  (%80 sarı, %100 kırmızı). Dosyalar: `config.catalog.ts`, `error-code.ts`, `i18n/*/errors.json`,
  `ai-budget.guard.ts`(+spec), 7 servis + `refresh-memory.handler`, `coach-access`/`photo-access`,
  `ai-cost-stats.service.ts`, `ai.module.ts`, `packages/types/ai.ts`, `apps/admin/.../AiCostCards.tsx`.

- **Çoklu konuşma — thread'ler (2026-07-14)** — Dilim 1'de ertelenen thread modeli geldi: yeni
  `coach_conversations` tablosu (title = **ilk kullanıcı mesajının ilk 60 karakteri**, LLM yok;
  `last_message_at` liste sırası) + `coach_messages.conversation_id` (FK cascade). Migration
  `0049_colorful_madrox` **backfill'li**: mesajı olan her kullanıcıya 1 konuşma yaratılıp mesajlar
  bağlanır, sonra kolon NOT NULL olur (eski model zaten kullanıcı başına tek sohbetti).
  **Multi-turn context artık thread-scoped** (`lastN(userId, conversationId, N)`) — farklı konular
  birbirine karışmaz; **memory profili kullanıcı-geneli kalır** (`recentForUser`, tüm thread'lerden
  damıtılır). `POST /chat` + `/chat/stream` gövdesi opsiyonel `conversationId` alır (yoksa yeni thread
  açılır, sahiplik doğrulanır → yoksa 404) ve yanıt/`done` `conversationId` döner. Yeni endpoint'ler:
  `GET /conversations`, `GET /conversations/:id/messages`, `DELETE /conversations/:id`.
  **Kaldırılan:** `GET/DELETE /v1/coach/messages` (+ "Yeni sohbet artık hiçbir şey silmez").
  Admin `listDownrated`'in "önceki soru" eşlemesi artık aynı thread içinde (doğruluk düzeltmesi).
  FE: hub'da `CoachConversationList` ("Son sohbetler", tıkla → `?c=<id>`, çöp → onay dialog'u);
  `CoachSessionProvider` thread-aware; ölü `recentTopics`/`coach-session-storage.ts` silindi.
  **Kapsam dışı:** yeniden adlandırma, LLM başlık, arama/pin/arşiv, thread-bazlı memory.
  Dosyalar: `schema.ts`, `coach-conversation.repository.ts`, `coach-message.repository.ts`,
  `chat.service.ts`(+spec), `ai-chat.controller.ts`, `ai.constants.ts`, `packages/{types,validation}`,
  `coach-session-context.tsx`, `coach-conversation-list.tsx`, `koc-hub.tsx`, `koc-chat-shell.tsx`, `coach.ts`.

- **KVKK bütünsel silme (2026-07-14)** — dokümanlarda uzun süredir işaretli açık kapandı: `admin
  anonymize` yalnız `users` satırını temizliyordu, kullanıcının **koça yazdığı tüm mesajlar** DB'de
  duruyordu. Artık her modül kendi verisini siler (workstreams §2 — admin orkestre eder, başkasının
  tablosuna yazmaz): `AiErasureService` (yeni, AiModule export) koç thread'leri + `coach_memory` +
  `ai_weekly_reviews`'ı siler; `CoachingErasureService` (bkz. coaching.md) coaching serbest metnini
  scrub eder; identity satırında `bio`/`website`/`avatar` da temizlenir + avatar objesi storage'dan
  best-effort silinir. Bir adım patlarsa **hata yükselir** (yarım silme sessizce raporlanmaz); akış
  idempotent, admin tekrar deneyebilir. `ai_usage` bilinçli olarak KALIR (maliyet meta, PII yok).
  Repo'lara `deleteAllForUser` (SERVICE ctx) eklendi. Dosyalar: `ai-erasure.service.ts`(+spec),
  `coach-conversation.repository.ts`, `coach-memory.repository.ts`, `weekly-review-cache.repository.ts`,
  `admin-users.service.ts`(+spec), `admin-users.repository.ts`, `admin.module.ts`, `ai.module.ts`.

- **Chat QoL paketi (2026-07-15)** — üç günlük-kullanım pürüzü kapandı: (1) `GET /v1/coach/access`
  PREMIUM yanıtı artık `dailyMessagesRemaining` döndürür (rolling-24h; `assertPremiumRateLimit` ile
  aynı `AiUsageRepository.countSince` sayacı — hint enforcement'la tutarlı). FE `/koc/chat`
  composer üstünde kalan ≤5 iken sakin muted hint gösterir (0 → anti-shaming "yarın devam" metni;
  composer kilitlenmez, 429 yolu aynen kalır); COIN modda mevcut `freeCoinMessagesRemainingToday`
  kullanılır, her başarılı mesajda local decrement (refetch yok). **§4 #3:** chat bölgesinde yalnız
  mesaj SAYISI, coin miktarı asla. (2) Koç balonu artık markdown render eder: `CoachMarkdown`
  (react-markdown + remark-gfm, zaten kurulu; dar eleman seti p/strong/em/ul/ol/li, raw HTML kapalı,
  heading/kod paragrafa düşer); system prompt'a "yalnız basit markdown" BİÇİM kuralı eklendi; user
  balonu düz metin. (3) Feedback satırına kopyala butonu (clipboard + 1.5s Check). Migration/endpoint/
  bağımlılık yok; api-client regen gerekmedi (FE `@mentor/types`'ı doğrudan kullanıyor). Dosyalar:
  `coach-access.service.ts`(+yeni spec), `ai.constants.ts`, `packages/types/ai.ts`,
  `coach-markdown.tsx` (yeni), `coach-transcript.tsx`, `koc-chat-shell.tsx`,
  `ai-coach.e2e-spec.ts`, `messages/{tr,en}.json`.

- **Proaktif günlük koç selamı (2026-07-15)** — `/koc` hub'ında premium kullanıcıya Puhu bubble'da
  güne özel 2-3 cümlelik LLM selamı: `POST /v1/coach/daily-greeting` (body yok). Birebir
  mood-reflection deseni; cache yeni `ai_daily_greetings` tablosunda (`UNIQUE(user, greeting_date)`,
  UTC gün, RLS self-or-service; migration `0051_w3_daily_greeting` — WIP `topics` diff'ini
  süpürmemek için `drizzle-kit generate --custom` + elle SQL). Gün boyu sabit mesaj (fingerprint
  tazeleme YOK — bilinçli), kullanıcı+gün başına en fazla 1 LLM çağrısı; `AiUsageFeature.DAILY_GREETING`
  ile ölçülür, budget guard'a tabi. Prompt `buildDailyGreetingPrompt` mevcut PII-free `CoachContext`'e
  (plan/seri yerine: countdown, mood, bugünkü plan, son seanslar, memory profili) dayanır; KESİN
  KURALLAR blokları aynen. **Free:** 403 — FE (`KocDailyGreeting`) yalnız `access.mode=PREMIUM`'da
  çağırır, hata/budget'ta sessizce görünmez (kural tabanlı brief herkes için kalır). **KVKK:**
  `AiErasureService` artık `ai_daily_greetings`'i de siler. Dosyalar: `daily-greeting.service.ts`(+spec),
  `daily-greeting.repository.ts`, `ai-mood.controller.ts`, `ai.constants.ts`, `schema.ts`,
  `ai-erasure.service.ts`(+spec), `packages/types/ai.ts`, `koc-daily-greeting.tsx`, `koc-hub.tsx`,
  `coach.ts` (web), `AiCostCards.tsx` (admin), `ai-coach.e2e-spec.ts`, `messages/{tr,en}.json`.

- **In-chat takip önerileri (2026-07-15)** — koç her yanıtın sonuna 2-3 kısa takip sorusu ekler:
  yeni `<<FOLLOWUP["soru","soru"]>>` marker'ı (Dilim 4 `<<TASK>>` altyapısının aynası).
  **Sıra sözleşmesi:** yanıt sonunda önce FOLLOWUP, en sonda TASK; backend önce TASK'ı, sonra
  FOLLOWUP'ı soyar (`extractFollowUps`, max 3 × 120 char). Stream holdback filtresi genelleşti —
  `createTaskMarkerFilter` artık iki marker prefix'ini de tutar (chunk sınırında bölünme dahil).
  `CoachChatReplyDto.followUps?` (append-only) hem `POST /chat` hem stream `done`'da. **Ephemeral:**
  persist edilmez, migration yok — FE (`koc-chat-shell`) chip'leri yalnız EN SON yanıtın altında
  gösterir, reload'da düşer. Chip tıklaması composer'ı DOLDURUR, göndermez (coin modunda kazara
  harcama yok — `?seed=` felsefesi). Fake adapter "nasıl" geçen mesajda deterministik 2 soru üretir
  (e2e varsayılan mesajı kapsar). Dosyalar: `suggested-task.ts`(+spec), `chat.service.ts`(+spec),
  `ai.constants.ts`, `fake-llm.adapter.ts`, `packages/types/ai.ts`, `coach-transcript.tsx`,
  `koc-chat-shell.tsx`, `ai-coach.e2e-spec.ts`, `messages/{tr,en}.json`.

- **Yanıtı yeniden üret — regenerate (2026-07-15)** — beğenilmeyen son koç yanıtı aynı soruyla
  yeniden üretilir: `POST /v1/coach/conversations/:id/regenerate/stream` (SSE, gövdesiz).
  **Spend normal mesajla aynı** (premium günlük haktan düşer, coin harcar; her regenerate yeni
  `spendRefId` — idempotency yok, kullanıcı kararı). **Satır yerinde güncellenir, silinmez:**
  `CoachMessageRepository.updateCoachReply` eski COACH satırının içerik/model/sources/suggestedTask'ını
  üretim BAŞARILI olunca değiştirir, feedback sıfırlanır; orta-akış hatasında history'ye dokunulmaz
  (coin refund mevcut yol). Üretimde history'den son USER+COACH çifti düşülür (`prepareChat
  excludeTailExchange`) — model kendi kötü yanıtına çapa atmasın. Mesaj sayısı sabit → memory
  tetikleyicisi bilinçli atlanır; `appendExchange` çağrılmaz. Stream sarmalayıcısı ortak
  `streamLlm` helper'ına çıkarıldı (replyStream de kullanır). FE: son koç yanıtının altında ↻
  (yalnız `activeConversationId` varken); delta'lar balonu yerinde günceller, hata eski yanıtı
  geri koyar; takip chip'leri ve kalan-hak göstergesi yenilenir. **Gotcha:** `contextMockExamId`
  persist edilmediği için regenerate deneme bağlamı OLMADAN üretir (mevcut "context is not
  persisted" gotcha'sının doğal sonucu). Dosyalar: `coach-message.repository.ts`,
  `chat.service.ts`(+spec), `ai-chat.controller.ts`, `coach.ts` (web, ortak SSE parser),
  `coach-transcript.tsx`, `koc-chat-shell.tsx`, `ai-coach.e2e-spec.ts`, `messages/{tr,en}.json`.

- **OpenAI gerçek-provider hardening (2026-07-15)** — `OpenAiLlmAdapter` ve
  `OpenAiVisionAdapter` için fetch kontrat testleri eklendi; blocking chat, parçalı SSE, token usage,
  1536-sonlu embedding invariantı, vision data URL/whitelist ve güvenli hata eşlemesi kapsanır.
  Provider response body/model çıktısı loglanmaz; yalnız HTTP status + varsa `x-request-id` tutulur.
  Production `AI_PROVIDER=fake` artık boot'u durdurur; AI kapatma `ai.enabled` ile yapılır. Kullanım:
  `pnpm --filter @mentor/api test:live:openai` dört düşük maliyetli gerçek çağrı yapar ve normal test
  suite'ine dahil değildir. Gotcha: komut gerçek ücret/ağ erişimi ve `apps/api/.env` içinde geçerli
  `OPENAI_API_KEY` ister. Dosyalar: `env.validation.ts`, `openai-{llm,vision}.adapter.ts`,
  `openai-adapters.spec.ts`, `vitest.live.config.ts`, `test/live/openai-live.spec.ts`.

- **Koç yapımı haftalık plan — Dilim 1/2: backend (2026-07-16)** — Faz 2 kalemi başladı:
  `POST /v1/coach/plan-draft` (premium §4 #5; opsiyonel `note` ≤500) mevcut `CoachContext`'e dayalı
  7 günlük plan TASLAĞI döner. LLM'den JSON-only çıktı istenir (`buildPlanDraftPrompt` —
  `PLAN_DRAFT_JSON_SENTINEL` fake adapter'ın da anahtarı); saf `parsePlanDraft`
  (`domain/plan-draft.ts`) code-fence toleranslı parse eder ve KLAMPLAR: [bugün, bugün+6], günde
  max 3, toplam max 15, title 200 / subject 80. Parse edilemezse 503 ama çağrı yine metered.
  Maliyet: yeni `ai.plan_draft.daily_limit` (default 5) + `AiUsageRepository.countFeatureSince` +
  budget guard; `AiUsageFeature.PLAN_DRAFT`. **Guardrail (workstreams §2): taslak persist
  EDİLMEZ, AI plan tablolarına yazmaz** — kullanıcı FE'de onaylayınca kayıt W2
  `POST /v1/plan-tasks/bulk` ile olur (bkz. coaching.md; iki endpoint arasında otomatik köprü yok).
  **Sıradaki tur (Dilim 2/2):** /plan sayfasında "Koçtan haftalık plan iste" butonu + önizleme/onay
  sheet'i (FE). Dosyalar: `plan-draft.ts`(+spec), `plan-draft.service.ts`(+spec), `ai.constants.ts`,
  `ai-usage.repository.ts`, `ai-chat.controller.ts`, `ai.dto.ts`, `ai.module.ts`,
  `fake-llm.adapter.ts`, `config.catalog.ts`, `packages/{types,validation}`, `AiCostCards.tsx`,
  `ai-coach.e2e-spec.ts`.

- **Koç yapımı haftalık plan — Dilim 2/2: web onayı (2026-07-16)** — `/plan` üzerindeki ikincil
  CTA erişimi yalnız tıklanınca kontrol eder; Premium kullanıcı opsiyonel notla taslak üretir,
  görevleri checkbox ile seçer ve kullanıcı onayından sonra W2 bulk endpoint'ine yollar. Sayfa
  açılışında AI/abonelik isteği yoktur; bulk retry aynı taslağı korur ve yeni LLM çağrısı yapmaz.
  Gotcha: mevcut görevler replace/dedupe edilmez, seçilenler append edilir. Dosyalar:
  `plan-coach-draft-action.tsx`, `plan-coach-draft-utils.ts` (web `src/lib` — spec'i
  `apps/api/src/plan-coach-draft-utils.spec.ts`, plan-seans-link deseni; api vitest include'u
  web altındaki spec'leri KOŞMAZ), `coach.ts`, `plan-tasks.ts`. Gerçek-provider E2E doğrulaması
  2026-07-16'da yapıldı (gpt-4o-mini; not→taslak→seçimli onay→bulk→/plan listesi).

- **Günlük selam /panel'de (2026-07-16)** — proaktif günlük selam artık panelde de: "Bugünkü ritim"
  kartındaki statik `rhythm_copy` satırı premium'da AI selamıyla değişir (yeni görsel eleman yok,
  dismiss yok — kartın doğal parçası). `/koc` hub'daki Puhu bubble KALDI (aynı user+gün cache'i —
  ekstra LLM maliyeti yok). Ortak `useDailyGreeting` hook'u (`apps/web/src/lib/use-daily-greeting.ts`):
  hata/403'te (free) null döner → statik satır kalır, sayfa asla kırılmaz; StrictMode-güvenli tek
  istek. Free kullanıcı panel başına 1 adet 403 probe'u yapar (ucuz — bilinçli, access ctx panele
  taşınmadı). Backend/i18n değişmedi. Dosyalar: `use-daily-greeting.ts`, `panel-shell.tsx`.

- **Prompt kalite turu — görünür çekirdek (2026-07-16)** — 4 prompt (chat+FOLLOWUP/TASK, günlük
  selam, plan taslağı, mood) gerçek gpt-4o-mini problarıyla değerlendirildi; rapor:
  [`plans/2026-07-16-prompt-kalite-turu.md`](../plans/2026-07-16-prompt-kalite-turu.md).
  **İki kod düzeltmesi:** (1) `extractReplyMarkers` — TASK/FOLLOWUP çıkarımı artık sıra-bağımsız +
  bozuk-yazılmış marker enkazı asla sızmaz (canlıda iki sızıntı türü de görüldü); chat'in 3 yolu
  buna geçti. (2) Premium chat limiti ve `dailyMessagesRemaining` artık yalnız `feature=chat`
  sayar (`countFeatureSince`) — selam/plan/mood çağrıları chat kotasını yemez. **Prompt ayarları:**
  chat'e kısalık + emoji≤1 + bağlam-sızması + kullanıcı-sesli FOLLOWUP kuralları; selama "max 3
  cümle, markdown/emoji yok" (selam düz metin render edilir — bold sızıntısı canlıda görüldü);
  plan taslağına "bugünkü plandaki görevi tekrar önerme"; mood'a markdown/emoji koruması.
  Sonra-probları: sızıntı yok, yanıtlar kısa, "merhaba"da chip'ler geliyor, selam 3 cümle/düz.
  Dosyalar: `suggested-task.ts`(+spec), `chat.service.ts`, `coach-access.service.ts`(+spec),
  `ai.constants.ts`, rapor.

## Gotchas / Known issues

- **Daily-greeting ilk üretimi yarışabilir** — cache satırı henüz yokken eşzamanlı iki istek
  ikisi de LLM çağırabilir; `onConflictDoNothing` sayesinde tek satır kazanır ve sonraki tüm
  istekler cache'ten döner. Dev'deki StrictMode çift-effect kaynağı FE'de `requestedRef` guard'ıyla
  kapatıldı (2026-07-15, `koc-daily-greeting.tsx`); kalan tek yarış prod'da aynı anda açılan iki
  sekme — üst sınır fazladan 1 çağrı, kabul edildi (budget guard + günlük cache kapsıyor).

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
- **Bütçe cap'i ~30s cache'li ve per-instance** — MTD harcama her istekte değil ~30s'de bir
  hesaplanır, yani cap aşımı sonrası en fazla ~1 cache penceresi + çok-instance sayısı kadar
  overspend olabilir (kesin hard-stop değil, yaklaşık). Cap **takvim ayı** (UTC) — ayın 1'inde sıfırlanır.
- **KVKK — ÇÖZÜLDÜ (2026-07-14):** `admin anonymize` artık **bütünsel silme** yapıyor —
  `AiErasureService` koç thread'lerini (mesajlar + `suggested_task` cascade), `coach_memory`'yi ve
  `ai_weekly_reviews`'ı siler; coaching kendi serbest metnini scrub eder (bkz. coaching.md).
  **`ai_usage` KALIR** (token/maliyet meta, PII yok — §7 maliyet muhasebesi). Kullanıcı ayrıca kendi
  profilini `DELETE /v1/coach/memory`, tek bir thread'i `DELETE /v1/coach/conversations/:id` ile siler.
  **Kapsam dışı:** forum içeriği (kamuya açık topluluk içeriği; yazar "Silinmiş Kullanıcı" görünür).
- **Memory profili yaklaşık ve gecikmelidir** — her 10 mesajda bir async job ile yenilenir; en son
  ~40 mesajdan damıtılır. Job runner (Cron/dev tick) çalışmıyorsa profil güncellenmez ama chat
  çalışmaya devam eder (context satırı düşer).
- **Multi-turn penceresi sabittir** (`CHAT_HISTORY_MAX_MESSAGES=10`, `ai.constants.ts`) — runtime
  config değil; tuning ihtiyacı doğarsa config catalog'a taşınır. Pencere **aktif thread'e** dairdir.
- **Thread vs memory kapsamı** — sohbet bağlamı thread-scoped (`lastN`), memory profili
  kullanıcı-geneli (`recentForUser`, tüm thread'lerden). Yani koç yeni bir thread'de eski thread'in
  mesajlarını hatırlamaz ama **profilini** (hedef/zorluklar) hatırlar. Thread silmek profili silmez
  (`DELETE /v1/coach/memory` ayrı).
- **Provider değişimi = 1 kez reembed** — sorgu embedding'i ile makale embedding'i aynı modelden
  olmalı; `AI_PROVIDER` değişince `POST /v1/admin/ai/reembed` (SUPER_ADMIN) çalıştırılmazsa RAG
  retrieval anlamsızlaşır (hata vermez, alakasız/boş kaynak döner). Maliyeti sentlerle ölçülür.
  `MODEL_PRICING_MICROS_PER_TOKEN` tablosuna yeni model eklenmezse `ai_usage.cost_micros` 0 yazar.
- **Stream yarıda kesilirse persist yok** — `coach_messages` yalnız tamamlanan exchange'i yazar;
  FE de parçalı balonu kaldırır, tekrar deneme yeni `clientMessageId` ile yeni spend'dir (aynı id
  ile idempotent).

## Related

- Seam: [coaching.md](./coaching.md) (mood, ghost, vision), [content.md](./content.md) (RAG source),
  [economy.md](./economy.md) (coin spend), [payments.md](./payments.md) (PremiumGuard)
- Web: [i18n.md](./i18n.md) (koc namespace)
- Status: [core/mvp-status.md](../core/mvp-status.md) (W3)


- **Premium haftalık koç yorumu (2026-07-11)** — `POST /v1/coach/weekly-review` aktif sınavın
  coaching tarafından hazırlanmış PII-minimal haftalık özetini en fazla üç kısa cümleyle yorumlar.
  Free kullanıcıya LLM çağrısı yapılmaz. Sonuç kullanıcı+sınav+hafta+locale ve aggregate fingerprint
  ile `ai_weekly_reviews` tablosunda cache'lenir; veri değişirse yeniden üretilir. Plan görevi AI
  tarafından yazılmaz, deterministik coaching odağından gelir. Migration: `0045_vengeful_shinobi_shaw.sql`.



- **Latest mock exam as explicit coach context (2026-07-14)** — `POST /v1/coach/chat` and
  `/chat/stream` now accept optional `contextMockExamId`. `ChatService` verifies ownership through
  the public `MockExamService.getById` boundary before creating a conversation, then grounds the
  prompt only with exam name/date, backend-computed total net, and subject D/Y/blank/net values.
  Publisher, photos, and personal notes are excluded; nets are never recalculated. Usage: open
  “Koça sor” from `/analiz?tab=gelisim`, edit the seeded message, then send. The web retries the same
  context after failures and removes only the context query after the first successful reply.
  Gotcha: the context is not persisted; later turns use normal conversation history. Missing/foreign
  attempts return the existing 404 and the current coin-refund path remains intact. Related files:
  `aiChatSchema`, `chat.service.ts`, `ai.constants.ts`, `ai-chat.controller.ts`,
  `koc-chat-shell.tsx`, `apps/web/src/lib/coach.ts`, generated OpenAPI client.

- **Single-question topic classification (2026-07-15)** — The Premium vision contract returns one `subjectSlug` and optional `topicSlug` from the active exam whitelist; the prompt keeps the no-solving/no-explanation guardrail. The server verifies the parent relation: an invalid topic falls back to the valid subject, while an invalid subject yields an empty result. Usage: upload one question photo in `Yanlışlarım`. Gotcha: OCR, confidence, and correction CRUD remain out of scope; photo/topic signals are not added to the AI coach prompt. Related: `vision.port.ts`, vision adapters, `photo-categorize.service.ts`.
