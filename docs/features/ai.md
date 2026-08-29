# AI

> AI coach: context injection (not training), LLM + pgvector RAG, photo→subject categorize, mood
> reflection, ghost narration, vision board note. Module: `modules/ai`. Workstream: W3.
> Roadmap: MVP; multi-turn, streaming, topic-level vision and consent-based structured mentor memory are live.

## Overview

The AI module is the intelligence layer — single LLM model with personalization via structured context
injection (no training/no fine-tuning). It provides premium-gated chat (RAG-grounded + sourced),
photo→subject classification, mood reflection, ghost (geçmiş-ben) narration, and vision board
motivation notes. Cost is controlled by premium gating + coin spending + rate-limits + daily caps.

## Architecture (key decisions)

- **Context injection, not training:** `CoachEvidenceService` builds aggregate PII-minimal evidence;
  `CoachTurnPlanner` deterministically selects intent, tone, relevant evidence and at most one action.
  Only selected evidence, bounded active-thread history and consented structured facts enter the prompt.
- **§4 #1 (hardest guardrail):** a deterministic intent resolver intercepts official dates/process/
  placement before budget, rate-limit, or spend checks. Dates render as persisted verified data cards;
  other official intents return only Knowledge Center sources. Completion is never called for this path.
  The system prompt remains a second-line refusal guard for non-deterministic chat.
- **LlmPort** (domain port): Fake/OpenAI/Gemini adapters. `AI_PROVIDER` selects the provider and
  `OPENAI_MODEL` selects its OpenAI model; production remains on the current default until the
  candidate model passes the Mentor V2 eval and rollout gates.
- **VisionPort** (module-local): `FakeVisionAdapter` + `GeminiVisionAdapter` + `OpenAiVisionAdapter` — photo→subject/topic classify only
  (§4 #2 — never solves).
- **StoragePort** (shared): `FakeStorageAdapter` + `R2StorageAdapter` — signed upload URL flow.
- **RAG:** async embedding pipeline (`ArticlePublished` → job → `LlmPort.embed` → `ContentService.
setArticleEmbedding`), retrieval via pgvector cosine similarity (≤0.6 threshold). Content-owned
  embedding (§3 — AI computes, content stores/searches). General coaching text is never embedded;
  official lookup embeds only `examType + fixed intent`, while article CTA chat uses its exact slug.
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

| Endpoint                                             | Purpose                                                                       |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| `POST /v1/coach/chat`                                | AI coach chat (multi-turn, RAG-grounded; optional `contextArticleSlug`)       |
| `POST /v1/coach/chat/stream`                         | Streaming chat (SSE; optional `contextArticleSlug`; delta → done/error)       |
| `POST /v1/coach/conversations/:id/regenerate/stream` | Regenerate the last coach reply (SSE; same spend as a message)                |
| `GET /v1/coach/conversations`                        | The user's chat threads, most-recently-active first                           |
| `GET /v1/coach/conversations/:id/messages`           | One thread's paginated history                                                |
| `DELETE /v1/coach/conversations/:id`                 | Delete one thread (messages cascade)                                          |
| `PATCH /v1/coach/messages/:id/feedback`              | Rate a coach reply (👍 1 / 👎 -1 / null)                                      |
| `GET/PATCH /v1/coach/profile`                        | Read/update calibration, memory consent and communication preferences          |
| `GET /v1/coach/memories`                             | Paginated allowlisted structured cross-thread facts                            |
| `PATCH/DELETE /v1/coach/memories/:id`                | Correct or forget one structured fact                                           |
| `DELETE /v1/coach/memories`                          | Clear all structured facts                                                      |
| `POST /v1/coach/messages/:id/action`                 | Explicitly accept/cancel one backend-allowlisted coach action                   |
| `GET /v1/coach/memory`                               | Read a legacy saved summary (not generated or injected into prompts)          |
| `DELETE /v1/coach/memory`                            | Delete the legacy saved summary (KVKK)                                        |
| `GET /v1/coach/access`                               | Access probe (PREMIUM/COIN/NONE)                                              |
| `POST /v1/coach/mood-reflection`                     | Premium mood AI reflection                                                    |
| `POST /v1/coach/daily-greeting`                      | Premium dashboard greeting (cached per user+day+locale)                       |
| `POST /v1/coach/plan-draft`                          | Premium 7-day plan draft PREVIEW (never persisted; user confirms via W2 bulk) |
| `POST /v1/coach/plan-adaptation`                     | Premium safe plan adaptation preview (user-confirmed apply via coaching)      |
| `POST /v1/coach/ghost-narration`                     | Premium ghost AI narration                                                    |
| `POST /v1/coach/vision-note`                         | Premium vision board AI note                                                  |
| `GET /v1/coach/photo-access`                         | Photo categorize access (upload URL)                                          |
| `POST /v1/admin/ai/reembed`                          | Backfill article embeddings (SUPER_ADMIN)                                     |
| `GET /v1/admin/metrics/ai`                           | LLM cost dashboard (window/model/top-spenders; SUPPORT+FINANCE)               |
| `GET /v1/admin/metrics/coach-feedback`               | Coach 👍/👎 satisfaction + recent 👎 replies (SUPPORT+FINANCE)                |

## Geliştirmeler (timeline)

- **Yoldaşlık sesi Dalga 2 — koç sohbeti (2026-08-28)** — Koç sohbeti (LLM + kural fallback) companion kaydına bağlandı; Puhu yalnız chrome'da (boş sohbet, FAB, onboarding, paywall, haftalık recap host). V2 persona TR/EN: sen, kısa cümle, suçluluk yok, Puhu imzası yok, en fazla bir emoji yalnız hafif anda. V1 `coachSystemBase(locale)` EN kullanıcıya artık TR gövde göndermiyor; mood/selam/seans/ghost/vizyon/plan-draft aynı ağız. `coaching.mood.SERIOUS_DISTRESS` ve resmî bilgi kuralları dokunulmadı. Kullanım: `docs/copy/voice.md`. Gotcha: haftalık recap Puhu host'u sohbete sızmaz; V1 bağlam etiketleri (BAĞLAM) hâlâ TR. İlgili: `mentor-v2-prompt.ts`, `ai.constants.ts`, `coaching.json`.

- **Kilit rozetleri (2026-08-22)** — Mood / ghost / günlük selam / seans yansıması web'de kilit
  CTA ile paywall'a bağlandı. API politikası değişmedi; `free_enabled` varsayılan kapalı.
  İlgili: `premium-lock-nudge.tsx`, `use-daily-greeting.ts`.
- **Özellik politikası (2026-08-22)** — Premium AI yüzeyleri `evaluateFeatureAccess` ile
  `free_enabled` + `free_limit` tadına açılabilir. Varsayılan flag kapalı = önceki premium-only
  davranış. Chat ve derin analizde coin yolu free tavanından sonra durur. İlgili:
  `premium-feature-gate.service.ts`, `photo-access.service.ts`, `chat.service.ts`,
  `deep-analysis.service.ts`.

- **Kişiselleştirilmiş Mentor V2 (2026-08-02)** — Koç kimliği “mentor-yol arkadaşı” olarak TR/EN
  ayrı ve sürümlü prompt'a taşındı. Saf `CoachTurnPlanner`; niyet, `GENTLE/WARM/DIRECT/CELEBRATORY`
  tonu, en fazla üç doğrulanmış kanıt ve tek aksiyon belirler. Resmî bilgi ve ciddi sıkıntı yolları
  LLM/kota/bütçeden önce deterministiktir. Aktif thread geçmişi config'li sayı + karakter bütçesiyle
  sınırlanır; TASK/FOLLOWUP/MEMORY marker'ları sıra bağımsız çıkarılır ve stream'e sızmaz. Üretim
  snapshot'ı `strategyVersion/intent/tone/usedEvidence` olarak mesajda kalır; web “Neye göre?” ile
  gösterir. `ai.coach_personalization_v2.rollout_percent=0` eski akışa anında döner; STAFF daima V2.
  İlgili: `coach-turn-planner.ts`, `mentor-v2-prompt.ts`, `chat.service.ts`, `0068`–`0070`.

- **Şeffaf hafıza, tanışma ve kullanıcı kontrollü aksiyonlar (2026-08-02)** — `coach_profiles` ve
  `coach_memory_facts` yalnız kullanıcı RLS'iyle eklendi. İlk tanışma LLM/kota tüketmez; hafıza ayrı
  açık onay ister. Model yalnız güncel kullanıcı mesajından allowlist aday üretir; backend birebir
  alıntı, hassas veri/PII, taksonomi ve TTL kontrolünden sonra yalnız normalize değeri saklar. Kaynak
  alıntı saklanmaz/loglanmaz; chat silinince CHAT fact cascade olur, kullanıcı düzeltmesi `USER_EDIT`
  olarak ayrılır. Web “Koçun bildikleri” ekranı düzenleme/unutma/durdurma/tümünü silme sunar.
  Aksiyonlar yalnız backend enum/payload'ıdır; görev oluşturma, plan uyarlama, seans başlatma ve
  güvenli yüzeye gitme ancak onaydan sonra çalışır. ACCEPTED/COMPLETED yanıt regenerate edilemez.
  TTL temizliği: `POST /v1/internal/cron/cleanup-coach-memory` (`CRON_SECRET`).

- **GPT-5 hazırlığı ve Mentor V2 eval (2026-08-02)** — Production varsayılanı değiştirilmeden
  GPT-5'in doğrulanmış $1.25/M input ve $10/M output fiyatı maliyet tablosuna eklendi; GPT-5
  reasoning isteklerinde uyumsuz özel temperature gönderilmez. Opt-in gerçek-model eval'i
  `OPENAI_EVAL_MODEL` (varsayılan `gpt-5`) ile 16 sentetik TR/EN vaka çalıştırır: cold start,
  düzenli ritim, kopuş, kaygı, plan yükü, ölçülü başarı ve stale hafıza çelişkisi dahil. Kullanım:
  `pnpm --filter @mentor/api test:eval:openai`; sonuç production aktivasyonundan önce incelenir.

- **Kişiselleştirme kanıtını yanıt içine taşıma (2026-08-01)** — Sıfır seans/sıfır görev
  özetleri artık kişisel kanıt sayılmaz ve LLM bağlamına yazılmaz. Model, ilgili sinyali yapısal
  marker ile seçer; API bu marker'ı doğrulanmış ve kullanıcıya görünür doğal bir ilk cümleye
  dönüştürür. Marker eksikse yalnız mevcut gerçek sinyallerden güvenli fallback seçilir. Veri
  yokken numaralı/genel yöntem menüsü tek netleştirici soruya çevrilir ve doğrulama bitene kadar
  stream tamponlanır. Web'deki `Neye göre?` disclosure'ı yalnız yanıtta gerçekten kullanılan
  sinyalleri gösterir; kullanılmayan sınav/bağlam veya `0 seans · 0 dk` gösterilmez. İlgili:
  `personalization-marker.ts`, `ai.constants.ts`, `chat.service.ts`,
  `coach-personalization-context.tsx`, `CoachPersonalizationDto.usedSignals`.
- **Kanıtı görünür kişisel koçluk (2026-08-01)** — Tüm normal AI Koç sohbetleri artık
  uygulanabilir PII-minimal bağlam varsa en az bir somut sinyali cevapta kullanır, tek öneri seçer
  ve neden uygun olduğunu açıklar; yalnız sınav türü olup çalışma verisi yoksa kişiselleştirmiş gibi
  davranmak yerine tek teşhis sorusu sorar. Her COACH mesajı üretim anındaki sınav, ruh hâli,
  son 7 gün seans/odak/ders ve bugünkü plan özetini `personalization_context` alanında saklar.
  Web, cevap altında yalnız kullanılan sinyallere ait `Neye göre?` disclosure'ı gösterir; geçmiş ve regenerate
  aynı sözleşmeyi korur. Bu davranış Topluluk köprüsüyle sınırlı değildir; topluluk konuşmalarında
  ayrıca mevcut yapısal kaynak kartı korunur. Migration: `0067_fixed_johnny_blaze.sql`. İlgili:
  `ai.constants.ts`, `chat.service.ts`, `coach-message.repository.ts`,
  `coach-personalization-context.tsx`, `messages/{tr,en}.json`.
- **Topluluk koç konuşmasından güvenli plan görevi (2026-08-01)** —
  `POST /v1/coach/conversations/:conversationId/plan-tasks`, kullanıcının onayladığı normal plan
  görevi alanlarını kabul eder; konuşma sahipliğini, `COMMUNITY_THREAD` origin'ini, forum
  görünürlüğünü/CHAT-QA uygunluğunu ve mevcut bridge flag'ini sunucuda yeniden doğrular. Thread,
  intent ve zone istemciden alınmaz; AI çağrısı, kota veya coin tüketimi yoktur. AI modülü yalnız
  Forum'un public bridge servisini ve Coaching'in public `PlanService` arayüzünü kullanır; tablo
  erişimi/FK ve ters Forum→AI bağımlılığı oluşmaz. İlgili:
  `community-coach-plan-task.service.ts`, `ai-chat.controller.ts`, `ai.module.ts`.
- **Topluluk kaynaklı koç konuşması pilotu (2026-07-31)** — Yeni koç sohbeti
  `contextCommunityThreadId` alabilir; backend uygunluğu Forum’un public servisiyle yeniden doğrular
  ve LLM’e yalnız `intent`, CHAT/QA türü, kürasyonlu etiket ve kullanıcının kendi mesajını geçirir.
  Forum metni/kimliği prompt’a veya analytics’e taşınmaz. Başarılı exchange transaction’ında
  conversation’a yapısal `COMMUNITY_THREAD` origin yazılır; geçmiş/regenerate bunu korur. Web taslağı
  otomatik göndermeden açar, kalıcı kaynak kartı ve güvenli `returnTo` sunar; önerilen görev ancak
  plan formunda kullanıcı kaydından sonra ölçülür. Kaynak silinirse konuşma çalışır, kart erişilemez
  duruma geçer. İlgili: `chat.service.ts`, `coach-{conversation,message}.repository.ts`,
  `coach-chat-shell.tsx`, `community-source-card.tsx`, `community-coach-bridge.ts`.
- **Koç desktop history rail toggle (2026-07-25)** — Desktop rail collapses to a narrow icon strip
  (52px): `PanelLeft` (expand), `SquarePen` (new chat), `MessageSquare` (open history). Expanded
  header keeps the top-right collapse control; width animates 288↔52 (~280ms). No floating button in
  the chat column. Mobile drawer unchanged. Related: `coach-chat-shell.tsx`, `coach-history-panel.tsx`,
  `messages/{tr,en}.json`.

- **Koç transcript edge fades (2026-07-24)** — Soft white→transparent gradient (`h-10`) at the
  **top** of the transcript column (bottom fade removed), matching the expandable “show more” veil.
  Related: `coach-chat-shell.tsx`.

- **Koç scroll-to-bottom control (2026-07-24)** — When the transcript is scrolled up, a centered
  circular jump button (white/blur + card shadow + ChevronDown, Mentor tokens) appears `mb-5`
  (20px) above the composer dock. Click smooth-scrolls to the latest message; auto-stick pauses
  while the user reads older messages (still follows on own send). Related: `coach-chat-shell.tsx`,
  `coach-transcript.tsx`, `messages/{tr,en}.json`.

- **Koç coach bubble chrome removed (2026-07-24)** — Coach reply / typing bubbles no longer use
  white background, border, or card shadow — text sits directly on the pastel chat backdrop. User
  bubbles unchanged. Related: `coach-transcript.tsx`.

- **Koç composer 10-line grow + bubble show more (2026-07-24)** — Composer textarea max grow raised
  to ~10 lines (`TEXTAREA_MAX_PX` ≈ 222, 200ms height ease unchanged). Long **user** bubbles use
  panel-style expand/collapse (`ExpandableBubbleContent`): measure + height motion + bottom fade;
  collapsed max **10 lines on desktop (lg+)**, **20 on mobile**. Toggle copy `coach_chat.show_more` /
  `show_less`. Coach replies always render in full (no clamp). Related: `coach-composer.tsx`,
  `expandable-bubble-content.tsx`, `coach-transcript.tsx`, `messages/{tr,en}.json`.

- **Koç history list redesign (2026-07-24)** — Flat ChatGPT-style history (desktop rail + mobile
  drawer): no message icon/date/card chrome; row hover + active tint; ⋯ on hover (always on touch)
  opens delete menu (confirm dialog unchanged). "Yeni sohbet" is a text+`SquarePen` row with hover,
  not a filled primary button. Related: `coach-conversation-list.tsx`, `coach-history-panel.tsx`,
  `messages/{tr,en}.json`.

- **Koç desktop scroll + top inset (2026-07-24)** — Transcript scrolls full-width beside the history
  rail so the scrollbar sits on the content edge; message column stays `max-w-2xl` centered. Extra
  top padding (`lg:pt-20`). Composer/chips remain docked below in the centered column. Related:
  `coach-chat-shell.tsx`, `coach-transcript.tsx`.

- **Koç desktop history rail (2026-07-24)** — On `lg+`, conversation history is an always-open left
  rail (`coach-history-rail`, shared `CoachHistoryPanel`); chat column stays `max-w-2xl` centered in
  the remaining space. Pastel backdrop fills the full coach content width (not only the chat column).
  Mobile keeps the history button + drawer (`lg:hidden`). Related: `coach-chat-shell.tsx`,
  `coach-history-panel.tsx`, `coach-history-drawer.tsx`.

- **Koç user bubble color (2026-07-24)** — User bubbles use soft `color-progress` (not near-black
  `color-main`) so they sit calmly on the pastel chat backdrop; white text kept. Related:
  `coach-transcript.tsx`.

- **Koç mascot placement (2026-07-24)** — Removed Puhu from coach reply / typing bubbles; composer
  leading icon is now `PuhuImage` (`default`, 28px). Feedback/source rows no longer use `pl-10`
  avatar offset. Related: `coach-transcript.tsx`, `coach-composer.tsx`.

- **Koç reply typewriter (2026-07-24)** — Coach answers type character-by-character while streaming
  (plain text + caret; catches up if SSE is ahead). On complete → full markdown, no slide-in.
  `prefers-reduced-motion` shows full text immediately. Related: `coach-reply-body.tsx`,
  `coach-transcript.tsx`.

- **Koç reply stream motion (2026-07-24)** — Earlier block fade/slide reveal; replaced by typewriter
  above.

- **Koç chat motion + composer grow (2026-07-24)** — Bubble/typing/follow-up enter uses shared
  `chatBubble*` ease-out (~380ms, y+opacity) from `stagger-motion.ts`. Composer textarea auto-grows
  upward by line (`scrollHeight`, 200ms height easing; instant under `prefers-reduced-motion`).
  Max lines later raised to ~10 — see **Koç composer 10-line grow + bubble show more**. Related:
  `coach-transcript.tsx`, `coach-composer.tsx`, `coach-follow-up-chips.tsx`, `stagger-motion.ts`.

- **Koç chat bubbles + follow-ups (2026-07-24)** — Tighter transcript spacing; coach bubble solid
  white + soft border/shadow (user stays `color-main`). Follow-up chips match landing scale (`h-9`,
  12px, wrap) and dock above the composer via `coach-follow-up-chips.tsx` (not inside the scroll
  log). Related: `coach-transcript.tsx`, `coach-chat-shell.tsx`, `coach-follow-up-chips.tsx`.

- **Koç composer dock (2026-07-24)** — Active chat composer no longer uses `sticky` + tab-bar
  bottom offset (double-counted against main’s already-cleared height). Same flex-dock as empty
  landing. Related: `coach-composer.tsx`, `coach-chat-shell.tsx`.

- **Koç chat header trim (2026-07-24)** — Active chat matches empty landing chrome: history button
  only; removed "Sohbet" / access subtitle. Composer stays bottom. Related: `coach-chat-shell.tsx`.

- **Koç chat backdrop (2026-07-24)** — DESIGN.md pastel blobs on all `/coach/chat` states (empty +
  active), including under the mobile tab gutter (`fixed` from `top-16`; `z-0` under tab). Related:
  `coach-chat-shell.tsx`.

- **Koç landing backdrop (2026-07-24)** — First pass scoped blobs to empty landing only; superseded by
  full chat backdrop above.

- **Koç landing typography (2026-07-24)** — Empty-chat titles match the Heidi reference: two equal
  weight display lines (`~22–24px`, `color-main`, heading font) with selective bold via
  `t.rich` (`İyi günler, **Name**` / `Sana **nasıl yardımcı** olabilirim?`). Related:
  `coach-empty-landing.tsx`, `messages/{tr,en}.json` (`coach.landing` greetings + `help_text`).

- **Koç new-chat landing (2026-07-24)** — `/coach` redirects to `/coach/chat`. Empty state is a
  Heidi-inspired landing (greeting + help, centered Puhu hero, starter chips above sticky composer).
  History opens from the top-left button as a left drawer (notification-drawer pattern: Yeni sohbet +
  conversation list). Hub overlay next-action card is replaced by a leading chip (`coach-next-action-chip`)
  using the same href helper as the dashboard card; static chips seed the composer without auto-send.
  Access gate still applies only on the chat route. Related: `coach/page.tsx`, `coach-chat-shell.tsx`,
  `coach-empty-landing.tsx`, `coach-starter-chips.tsx`, `coach-history-drawer.tsx`,
  `coach-next-action-href.ts`, `messages/{tr,en}.json`, `e2e/coach.spec.ts`. Hub-only components
  (`coach-hub.tsx`, `coach-hub-brief.tsx`, `coach-memory-card.tsx`) removed.

- **PII-minimal, locale-correct coach context (2026-07-22)** — Automatic `CoachContext` now carries
  only exam type, coarse mood level, session/focus counts, taxonomy subjects, and plan progress
  counts. Mood/session notes and user-written plan titles are excluded from automatic prompts;
  serious-distress checks remain local for both mood and session reflections. Failed context
  sources emit source-only structured warnings and do not drop the remaining context. Chat, daily
  greeting, mood, session, vision note, ghost, plan draft, and plan adaptation share the active
  TR/EN prompt-locale rule. Mood/session/vision/ghost caches persist their locale, while daily
  greetings are keyed by `(user, UTC day, locale)`; legacy null-locale rows miss once and regenerate.
  Migration `0058` was generated from Drizzle schema. `plan-draft` and `ghost-narration` remain
  backward-compatible legacy endpoints and have no new web consumer. Related:
  `context-builder.service.ts`, `prompt-locale.ts`, AI prompt services, coaching cache services,
  `schema.ts`, `0058_curvy_stature.sql`.

- **Kullanıcı onaylı adaptif plan önizlemesi (2026-07-21)** —
  `POST /v1/coach/plan-adaptation`, bugün + 6 günlük bekleyen planı coaching'in public
  `PlanService` sınırından alır ve modele yalnız geçici `T1` referansları, sınav türü, kaba
  çalışma özeti ve açık kaynak sinyalini gönderir. `PLAN` kaynağındaki opsiyonel not kullanıcı
  tarafından açıkça yazılmışsa prompt'a girer; mood ve seans struggle notları girmez. Parser;
  bilinmeyen referansları, aynı güne/pencere dışına taşımaları, tekrarları ve günlük üç görev
  kapasitesini reddeder. Model-visible görev listesi 21 bekleyen görevle sınırlıdır; revision,
  duplicate ve kapasite doğrulaması yine tam yedi günlük snapshot üzerinden yapılır. `MOOD` ve
  `SESSION` kaynakları backend'de tekrar doğrulanır; uygulanabilir
  düşük-mood görevi yoksa `model: rules` ile LLM/usage olmadan `NO_CHANGE` döner. Gerçek çağrılar
  `plan_adaptation` usage etiketiyle yazılır ve legacy `plan-draft` ile aynı
  `ai.plan_draft.daily_limit` kotasını paylaşır. Free/AI-disabled/budget/provider hatalarında plan
  mutasyonu veya coin yolu yoktur. Önizleme hiçbir coaching tablosuna yazmaz; kullanıcı seçimini
  ayrıca `POST /v1/plan-tasks/adapt` ile uygular. Eski `POST /v1/coach/plan-draft` endpoint'i
  geriye uyumluluk için korunur; yeni web akışı onu çağırmaz. İlgili dosyalar:
  `plan-adaptation.ts`, `plan-adaptation.service.ts`, `plan-draft.service.ts`,
  `ai-chat.controller.ts`, `packages/{types,validation}`,
  `plan-coach-adaptation-action.tsx`.

- **Vision adapter Responses API'ye taşındı (WP-H, 2026-07-20)** — `openai-vision.adapter.ts` de
  `POST /v1/responses` kullanıyor; APP-028'de ertelenen tek yarım thread kapandı. Değişimler:
  `system` → `instructions`; görsel typed `input_image` content part'ı (`{type:"input_image",
image_url: dataUrl}` — eski `{type:"image_url",image_url:{url}}` değil); JSON çıktısı
  `text:{format:{type:"json_object"}}` (eski `response_format` değil); `max_tokens` →
  `max_output_tokens`; yanıt `collectOutputText(output)` ile yürünür + `status incomplete|failed`
  guard. LLM adapter'ının `providerErrorLog` + `collectOutputText` helper'ları artık iki tüketicili
  olduğu için `openai-responses.util.ts`'e çıkarıldı (saf taşıma, LLM davranışı aynı). `VisionPort`
  sözleşmesi, fake/gemini-vision, `photo-categorize.service.ts` ve `CategorizePhotoResultDto`
  değişmedi. Spec vision bloğu Responses şekline yeniden yazıldı (16/16). Dosyalar:
  `openai-vision.adapter.ts`, `openai-responses.util.ts`, `openai-llm.adapter.ts`,
  `openai-adapters.spec.ts`.
- **OpenAI Responses API migrasyonu (APP-028 WP-G, 2026-07-20)** — `openai-llm.adapter.ts` artık
  Chat Completions yerine `POST /v1/responses` çağırıyor: `system` → top-level `instructions`;
  `user` + `history` → `input` mesaj dizisi (basit string content, 1:1 `LlmHistoryMessage`);
  `max_tokens` → `max_output_tokens`. Yanıt `output[]` içindeki `message`/`output_text` parçaları
  yürünerek toplanır (`output_text` convenience'ına güvenilmez — raw HTTP JSON'da yoktur);
  `usage.input_tokens/output_tokens` → prompt/completion. Streaming SSE tipli event'lere geçti:
  `response.output_text.delta` → `{delta}`, `response.completed` → usage yakala,
  `response.failed|incomplete|error` → `AI_PROVIDER_ERROR`; `[DONE]` sentinel ve
  `stream_options.include_usage` kaldırıldı. **Zero-SDK fetch stili korundu**; `LlmPort` sözleşmesi,
  fake/gemini adapter'ları, embeddings (`/v1/embeddings` değişmez) ve 9 çağrı yerinin hiçbiri
  değişmedi. Rollback: tek dosya, `AI_PROVIDER=openai` arkasında (`git revert` chat/completions'a
  döner); pricing tablosu değişmez (`gpt-4o-mini` aynı). Spec fixture'ları Responses şekline yeniden
  yazıldı (16/16). (Vision o turda ertelenmişti; WP-H'de tamamlandı — bkz. üstteki girdi.)
  Dosyalar: `openai-llm.adapter.ts`, `openai-adapters.spec.ts`.
- **Durable coach history + recoverable transcript (2026-07-20)** — New conversations are no longer
  inserted before provider success. Blocking chat, SSE, and verified official replies use one
  transaction that creates the conversation when needed, writes the USER+COACH pair, and returns the
  persisted conversation ID. Persistence failure is now a request failure: coin spend is refunded,
  while real provider usage and Premium allowance consumption remain recorded. Regenerate follows
  the same rule and emits no terminal success unless the replacement row is durably updated. Legacy
  empty rows are
  retained but excluded from conversation items and total; direct empty-history links return 404.
  On web, list/history loading and failure states are explicit, first-page failure locks the composer,
  and retry/new-chat recovery is available. History stays at 30 messages per page; “Daha eski
  mesajları yükle” prepends deduplicated pages without moving the visible reading position. Stream or
  persistence failure removes the complete optimistic exchange and restores the submitted text.
  Gotcha: loading an older page can fail independently without clearing visible history or locking the
  composer. Public endpoints and DTOs are unchanged. Related: chat.service.ts,
  coach-message.repository.ts, coach-conversation.repository.ts, coach-session-context.tsx,
  coach-transcript.tsx, coach-chat-shell.tsx, coach-conversation-list.tsx.
- **Daily continuity + verified official flow (2026-07-20)** — `/coach` is available even when chat
  access is unavailable and starts its independent `GET /v1/coaching/today` request immediately.
  The primary card renders the backend-localized `nextAction`; `/coach/chat` remains access-gated.
  Official intent (`EXAM_DATE`, `APPLICATION`, `RESULT_PLACEMENT`, `PROCESS`) is resolved before AI
  budget/rate/spend checks. Exam dates are returned and atomically persisted as `officialCountdown`
  with `model: "verified-content"` (migration `0057`) and reload as `@mentor/ui` `DataCard`; other
  official questions return verified article sources without completion or usage rows. General chat
  no longer sends raw messages to embeddings; an explicit `contextArticleSlug` still enables exact-
  article grounded conversation. Exact countdown and legacy memory were removed from all coach
  prompts/context; new chats no longer enqueue memory jobs, while the registered legacy handler
  validates and no-ops queued payloads. Consent-gated `coach_hub_view`, `coach_next_action_click`,
  and successful `coach_session_start` events contain only access/action enums. Related:
  `chat.service.ts`, `official-intent.ts`, `context-builder.service.ts`, coach web components,
  `analytics.ts`, `0057_sturdy_korvac.sql`.

- **Weekly-review narration: coin unlock gate (APP-025, 2026-07-19)** — `POST /v1/coach/weekly-review`
  artık salt premium değil: `!premium` ise `economy.enabled` VE o (sınav, hafta) için derin analiz
  unlock'ı (`DeepAnalysisService.isUnlocked`, ledger spend satırı) şartıyla geçer; yoksa eskisi gibi
  `PAYMENT_PREMIUM_REQUIRED` 403. Evidence artık premium kontrolünden önce okunur (weekStart gate
  için gerekli); budget/metering/cache değişmedi. Web'de ilk tüketici: `/analysis` derin analiz kartı
  (bkz. [economy.md](./economy.md)). AI chat bölgesinde coin UI yok (§4 #3).
- **Coach source naming and localized routes (2026-07-19)** — Web source folders, components, symbols,
  tests, and the hero asset moved from `koc-*`/`Koc*` to `coach-*`/`Coach*`; Turkish users still
  navigate through `/koc` and `/koc/sohbet`, while English uses `/en/coach` and
  `/en/coach/chat`. Related: coach route components, `coach.ts`, `coach-hero.png`.
- **Slice 1 — Lean chat** — premium-gated, single-turn, `LlmPort` (fake/OpenAI), §4 #1 refusal,
  `ai_usage` metering, premium daily rate-limit. _(0030.)_
- **RAG grounding** — async embedding pipeline (`ArticlePublished` → job), pgvector cosine retrieval,
  source chips in web koç UI, admin backfill endpoint. Content-owned embedding. _(0043.)_
- **Coin → AI chat spend** — `EconomyService.spend()`, free daily coin allowance, LLM-failure refund.
  _(0045.)_
- **Photo → subject categorize** — `VisionPort` + `StoragePort` + `FakeVisionAdapter`/`GeminiVisionAdapter`,
  premium monthly cap, subject-level only (§4 #2). _(0047.)_
- **Mood AI-adaptive** — premium mood reflection (PII-free grounding: exam + countdown + coarse mood),
  daily idempotent cache, coach chat mood-aware. _(0048.)_
- **Ghost AI narration** — premium AI narration on latest mock-exam attempt, rule-based comparison for
  all users. _(0049.)_
- **Koç hub + chat split** — `/koc` hub (greeting, shortcut cards, session recent pills, start/continue CTAs) and `/koc/chat` (back header, transcript, composer). `CoachSessionProvider` in `koc/layout.tsx` persists messages + recent topics in `sessionStorage` (`mentor:coach-session:v1`) for the browser tab only — no backend history. Hub shortcuts and panel coach CTA deep-link via `?seed=` (composer pre-fill). Gate blocks both routes when `canChat=false`. Puhu avatar on coach bubbles; Encouraging Puhu on gate. _(2026-06-30.)_
- **Puhu coach bubble** — reusable `PuhuCoachBubble` (`apps/web/src/components/puhu-coach-bubble.tsx`): white speech card + tail (`.mentor-coach-bubble`), dismiss X, optional bounce; wired on `/koc` gate (reason-specific copy) and hub welcome. _(2026-06-30.)_
- **Koç hub generated hero** — `/koc` now uses the generated `koc-hero.png` as the main app-poster visual, with only a greeting overlay and start/continue CTAs. Dense shortcut-card grid and prompt chips were removed. Usage unchanged (`/koc`, `/koc/chat?seed=...`). Gotcha: chat route and access gate were intentionally left unchanged. Files: `koc-hub.tsx`, `koc-content-skeleton.tsx`. _(2026-07-03.)_
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
  merkezî config'teki `ai.coach.history_max_messages` (varsayılan 10) ve
  `ai.coach.history_max_characters` (varsayılan 6.000) sınırları içinde mesajları
  `LlmPort.complete({ history })`'ye enjekte eder (defensive
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
  yoksa 404). Exchange persistence `suggestedTask`'ı da USER+COACH çiftiyle birlikte saklar; güncel
  zorunlu/atomik persistence davranışı bu timeline'ın 2026-07-20 kaydında açıklanır. FE: `FeedbackRow` (optimistic, hata revert); hydrate feedback+suggestedTask'ı
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
  tetikleyicisi bilinçli atlanır; `persistExchange` çağrılmaz. Stream sarmalayıcısı ortak
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
  Panel **Bugünkü ritim** copy collapses at 3 lines with **Daha fazla / Daha az** when the
  premium greeting (or rare long fallback) overflows (`ExpandableRhythmCopy`).

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
- **Prompt kalite turu — kalan 5 prompt (2026-07-16, tur 2)** — ghost · vision note · seans
  yansıması · haftalık özet · memory damıtma gerçek problarla değerlendirildi (aynı rapora eklendi).
  Ayarlar: hepsine max-3-cümle/markdown-emoji-coşku yasağı varyantları; vision'a hitap kalıbı
  yasağı ("Sevgili öğrencim" canlıda görüldü); seans TASK'ına "bugünkü plandaki görevi önerme";
  memory'ye "düz 'Etiket: değer' maddeleri" (bold profil FE kartında ham `**` görünüyordu);
  `WEEKLY_REVIEW_PROMPT_VERSION` v1→v2 (cache'li anlatılar yeni kurallarla yeniden üretilsin).
  **Bilinen kalıntı:** seans yansıması TASK'ı, plandaki mevcut görevi bazen başka kelimelerle yine
  önerebiliyor — zararsız (kullanıcı onaysız yazılmaz), deterministik benzerlik filtresi backlog.
  Dosyalar: `ai.constants.ts`, `weekly-review-prompt.ts`.
- **AI prompt kalite eval v1 (2026-07-16)** — `pnpm --filter @mentor/api test:eval:openai`
  10 sentetik vaka çalıştırır: dokuzu mevcut `OpenAiLlmAdapter` ile gerçek completion, ciddi mood
  sinyali ise production gibi deterministik güvenlik yoludur (0 token/0 maliyet). Chat resmî-bilgi/
  kaygı, günlük selam, mood güvenliği, plan taslağı, seans, ghost, vision, haftalık değerlendirme ve
  memory kapsanır. Gerçek kullanıcı/DB verisi yoktur; komut opt-in'dir ve CI'a dahil değildir. Resmî
  bilgi uydurma, PII, marker sızıntısı, geçersiz JSON ve ciddi-sinyal güvenliği **hard** kontroldür;
  cümle uzunluğu gibi üretken-model stil sapmaları flaky kapı olmaması için **review** uyarısıdır.
  Her koşu model, token, tahmini maliyet, gecikme, ham sentetik çıktı ve manuel rubric'i
  `apps/api/eval-results/latest.md` dosyasına yazar; dizin gitignore'dadır. Yeni endpoint, tablo,
  migration veya eval bağımlılığı yoktur.
- **Ciddi mood sinyali güvenlik bypass'ı (2026-07-17)** — `MoodReflectionService`, açık ve yüksek
  güvenli TR/EN zarar/yaşam sinyallerini LLM ve cache'den **önce** algılar; lokalize sabit destek
  mesajını `model: safety` ile döndürür. Bu yol context, bütçe, provider, kullanım ölçümü ve DB yazımı
  yapmaz; böylece eski uygunsuz bir cache de gösterilmez. Kapsam bilinçli olarak yüksek güvenli
  ifadelerle sınırlıdır; daha geniş kapsama ancak gerçek veri ihtiyacı doğrulanırsa ayrı moderation/
  safety classifier eklenir. Dosyalar: `serious-distress.ts`(+spec), `mood-reflection.service.ts`
  (+spec), `i18n/locales/{tr,en}/coaching.json`, `test/eval/openai-prompt.eval.ts`.

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
- **KVKK — ÇÖZÜLDÜ (2026-08-02):** `admin anonymize` artık **bütünsel silme** yapıyor —
  `AiErasureService` koç thread'lerini, yapılandırılmış hafıza gerçeklerini, mentor profil/onayını,
  legacy `coach_memory`'yi ve AI cache'lerini siler; coaching kendi serbest metnini scrub eder.
  **`ai_usage` KALIR** (token/maliyet meta, PII yok — §7 maliyet muhasebesi). Kullanıcı ayrıca kendi
  profilini `DELETE /v1/coach/memory`, tek bir thread'i `DELETE /v1/coach/conversations/:id` ile siler.
  **Kapsam dışı:** forum içeriği (kamuya açık topluluk içeriği; yazar "Silinmiş Kullanıcı" görünür).
- **Legacy memory is inactive** — new chats do not enqueue or regenerate `coach_memory`, and saved
  summaries are not injected into any prompt. `GET/DELETE /v1/coach/memory` and existing rows remain
  solely for backward compatibility and the user's deletion right; queued legacy jobs validate then no-op.
- **Multi-turn penceresi config'lidir** — `ai.coach.history_max_messages` varsayılan 10 mesaj,
  `ai.coach.history_max_characters` varsayılan 6.000 karakterdir; tüm geçmişi prompt'a sürüklemez.
  Pencere aktif thread'e aittir.
- **Cross-thread yalnız yapılandırılmış hafıza** — yeni thread eski mesajları veya legacy özeti almaz;
  yalnız açık onaylı, allowlist key/value gerçekleri alır. Hafıza durdurulunca yeni fact öğrenilmez ve
  mevcut fact'ler prompt'a girmez; kullanıcı isterse ayrıca tümünü siler.
- **Provider değişimi = 1 kez reembed** — sorgu embedding'i ile makale embedding'i aynı modelden
  olmalı; `AI_PROVIDER` değişince `POST /v1/admin/ai/reembed` (SUPER_ADMIN) çalıştırılmazsa RAG
  retrieval anlamsızlaşır (hata vermez, alakasız/boş kaynak döner). Maliyeti sentlerle ölçülür.
  `MODEL_PRICING_MICROS_PER_TOKEN` tablosuna yeni model eklenmezse `ai_usage.cost_micros` 0 yazar.
- **Stream veya history persistence yarıda kesilirse exchange yok** — yeni thread + USER + COACH
  aynı transaction'dadır; hata rollback olur ve FE iki optimistic balonu da kaldırıp metni composer'a
  döndürür. Provider kullanımı gerçekten oluştuysa usage/Premium hakkı korunur; coin mevcut hata
  yoluyla iade edilir. Tekrar deneme yeni clientMessageId ile yeni spend'dir (aynı id ile idempotent).

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

- **Bilgi makalesinden kesin kaynak aktarımı (2026-07-18)** — Bilgi → Koç CTA'sı ilk mesajda
  `contextArticleSlug` taşır. Backend yalnız yayımlanmış ve kullanıcının sınav ailesiyle eşleşen
  makaleyi kaynak yapar; ilk yanıt embedding backfill'ine bağlı değildir.

- **Haftanın Hikâyesi aggregate plan anlatımı (2026-07-26)** — Haftalık AI prompt'u v3'e
  yükseldi ve kural tabanlı recap'in taksonomi-doğrulanmış ders/görev sayaçlarını yorumlayabiliyor.
  LLM kanıtı PII-minimal kalır: ham görev başlığı, struggle note ve mood notu gönderilmez.
  Cache fingerprint'i görev `id/status/taskDate/updatedAt` değerlerini içerdiği için aynı haftadaki
  görev değişikliği mevcut `ai_weekly_reviews` kaydını güvenle yeniler. Kullanım: Premium veya
  deep-analysis ledger unlock'ı olan READY kullanıcı hikâyeyi beklemeden açar; anlatım arka planda
  gelir, hata/gecikmede deterministik Puhu notu kalır. Gotcha: PARTIAL/EMPTY hiçbir AI çağrısı veya
  satış CTA'sı üretmez; endpoint/cache/coin idempotency sözleşmeleri değişmedi. İlgili dosyalar:
  `weekly-review-prompt.ts`, `weekly-review-narration.service.ts`,
  `weekly-review-narration.service.spec.ts`.

- **Mentor Wrapped AI yorumu v4 (2026-07-27)** — Tek cached haftalık anlatım çağrısı artık
  backend'in seçtiği haftalık unvanı ve en fazla iki aggregate highlight'ı sıcak bir kapanışa
  bağlar; model unvan, metrik veya başarı sırası seçmez. Prompt hâlâ ham görev başlığı, struggle
  note, mood notu ve diğer serbest kullanıcı metinlerini almaz. Mevcut ve önceki haftadaki ilgili
  seans/görev değişiklikleri fingerprint'i yeniler. Premium/coin gate, deep-analysis ledger
  unlock'ı ve deterministik hata fallback'i değişmedi. Kullanım: READY hikâye hemen açılır,
  anlatım arka planda tek kez hazırlanır. İlgili dosyalar: `weekly-review-prompt.ts`,
  `weekly-review-narration.service.ts`, `weekly-review-narration.service.spec.ts`.

- **Mentor Wrapped AI anlatımı v5 (2026-07-29)** — Haftalık koç prompt'u tüm
  `WeeklyReviewDto` nesnesini göndermek yerine yalnız backend'in seçtiği unvan, highlight'lar,
  aggregate ritim/plan/performans, odak zamanı, güç günü ve deterministik sonraki adımdan oluşan
  küçük bir evidence nesnesi kullanır. Üç kısa cümle sırasıyla reveal, proof ve forward-motion
  vuruşlarını üretir; unvan türü yalnız hafif editoryal metafor çerçevesi seçer. Model hâlâ metrik,
  unvan veya görev seçmez; raw task title, mood/struggle note, gün dizisi ve geniş review payload'ı
  prompt'a girmez. Prompt `v5` olduğu için eski cache fingerprint'leri doğal olarak yenilenir;
  endpoint, Premium/coin gate ve cache tablosu değişmedi. İlgili: `weekly-review-prompt.ts`,
  `weekly-review-narration.service.spec.ts`.

- **Mentor Wrapped karakter anlatımı v6 (2026-07-29)** — Deterministik haftalık karakter
  adları Mentor'un yeni fantastik/futuristik iki kelimelik evrenine geçirildi. AI karakter
  seçmeye veya yeniden adlandırmaya devam etmez; backend'in verdiği yeni localized ad ve
  aggregate kanıtı üç vuruşlu anlatıya bağlar. Prompt sürümü `v6` olduğu için eski karakter
  adlarını içeren cached anlatımlar yeni fingerprint ile üretilir. Endpoint, Premium/coin gate,
  PII-minimal evidence şekli ve fallback davranışı değişmedi. İlgili:
  `weekly-review-prompt.ts`, `weekly-review-narration.service.spec.ts`,
  `i18n/locales/{tr,en}/coaching.json`.

- **AI motivasyon notu hedefi yeniden tanıyor (2026-08-02)** — Harita geldiğinde arayüz yalnız
  `targetCityCode` yazmaya başladı; eski serbest metin `target_city` artık hep `null` kalıyordu. Ama
  `vision-note.service` hâlâ o alanı okuyordu, dolayısıyla **premium AI notu kullanıcının şehrini
  bilmiyordu**. "Neden?" alanı da formdan kaldırılınca not pratikte yalnız `goalTitle`'dan üretilir
  hale gelmişti — premium bir özellik sessizce zayıflamıştı.
  Düzeltme: `VisionService.resolveTargetNames` panonun okuma kuralını uygular (kod varsa kodun adı,
  yoksa eski metin) ve `GeoService.resolveNames` ile şehir/üniversite adını çözer. **Yalnız cache
  miss'te çağrılır** — her okumada iki sorgu, kimsenin bakmadığı bir string için harcanırdı.
  Aynı yerde not zenginleşti: hedef üniversite ve kariyer alanı da prompta giriyor. Üniversite varsa
  şehir ayrı satır olarak tekrarlanmıyor, parantez içinde geçiyor (üniversite şehrini zaten ima eder).
  Kariyer grubu ham enum değil, `coach-evidence`'ın da okuduğu `coaching.coachEvidence.values.careerGroup`
  tablosundan yerelleştirilmiş etiket olarak gidiyor.
  `buildVisionNotePrompt` beş pozisyonel argümandan `VisionNoteGoal` nesnesine geçti.
  **Gotcha:** bu regresyonu tip sistemi yakalayamazdı — `targetCity` hâlâ geçerli bir alan, sadece
  artık hiç dolmuyor. `vision-note.service.spec` bunu üç testle kilitliyor (kodla verilen şehir
  promptta çıkıyor mu, üniversite şehri bastırıyor mu, kariyer etiketi çevriliyor mu).
  İlgili: `vision-note.service.ts`, `vision.service.ts`, `geo.service.ts`, `geo.repository.ts`,
  `ai.constants.ts`, `prompt-locale.spec.ts`.

- **Vision'ın işi değişti: kategorize → defter ön-etiketleme (2026-08-14, APP-042)** — `foto → ders/konu
  kategorize` tek başına bir vitrin özelliğiydi ve öğrenciye zaten bildiğini söylüyordu; analiz
  sayfasındaki kart kaldırıldı. `PhotoCategorizeService` **duruyor**, işi değişti:
  `prelabelNotebookPhoto()` yanlış defterine kart eklenirken ders/konu **önerir**, öğrenci tek tapla
  onaylar veya düzeltir. Aynı whitelist'li prompt (`PHOTO_CLASSIFY_SYSTEM`), aynı `PhotoAccessService`
  kotası, aynı `AiBudgetGuard` — §4 #2 (çözmez, sınıflandırır) ve §4 #4 (free'de koşulsuz AI yok)
  aynen korunuyor. Uç: `POST /v1/coaching/notebook/entries/prelabel` (AI modülünde, çünkü coaching
  vision'ı import edemez — döngüsel modül kenarı).
  **İki bilinçli fark:** (1) `clientRequestId` yok — ön-etiketleme kalıcı bir satır üretmiyor, dedupe
  edecek yer yok; elle yeniden deneme bir kota birimine mal oluyor, bunu önlemek için tablo açmak
  pahalı. (2) İstemcide **başarısızlık hata değil**: free kullanıcı, tükenmiş kota ve kararsız model
  aynı sonuca çıkar — öğrenci kendisi etiketler, ki bu her zaman çalışan yol.
  `mock-exams/{id}/categorize-photo` ucu geriye dönük uyumluluk için duruyor ama artık hiçbir
  istemci çağırmıyor; `mock_exam_photo_categorizations` yazılmıyor (temizlik ayrı migration).
  İlgili: `photo-categorize.service.ts`, `ai-mock-exam-photo.controller.ts`, `ai.dto.ts`.
