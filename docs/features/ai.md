# AI Companion — Puhu (`modules/ai` · W3)

> Puhu AI companion (`/koc/sohbet`), `Puhu’yla planla`, daily greeting, mood & session reflections,
> Weekly Recap & Deep Analysis narration, Vision topic classification, and pgvector RAG.

---

## 1. Overview & Architecture

`AIModule` is the intelligence layer of PuhuKoç. It uses **structured context injection (never model
training or fine-tuning)** over a provider-neutral `LlmPort` (`OpenAI` default) and `VisionPort`
(`Gemini Flash` / `OpenAI`).

- **Identity & Voice (`docs/copy/voice.md`):**
  - In user-facing UI and chrome, the AI coach is named **Puhu** (`"Puhu, yapay zekâ koçun"`, `"Puhu’yla planla"`; Turkish writes `"yapay zekâ"`, never `"AI"`).
  - Inside chat replies and reflections (`modules/ai/prompts/`), Puhu speaks in the **Companion** register: calm, warm, first-person (`"Ben buradayım"`), without exclamation marks or bird/mascot jokes.
- **Hard Guardrails (`AGENTS.md` §4):**
  1. **Official exam facts (§4 #1):** A deterministic intent resolver intercepts official dates, processes, and placement rules *before* any LLM call, budget check, or quota spend, returning verified data cards or Knowledge Center articles.
  2. **Vision = Classification Only (§4 #2):** `PhotoCategorizeService` maps a question photo to its exam `subject`/`topic` and **never** solves or explains the question.
  3. **No Unconditional Free AI (§4 #4):** Every student AI endpoint requires Premium (`PremiumGuard`), an earned/Coin-unlocked right (`EconomyService`), a coach-sponsored seat, or a configured feature taste.
  4. **Student → Coach Privacy (§4 #5):** Chat messages (`coach_messages`) and structured memories (`coach_memory_facts`) are strictly self-only (RLS `app.user_id`) and are never exposed to a human coach (`MentorshipModule`).
  5. **KVKK (§4 #6):** `CoachEvidenceService` strips PII before building prompts; provider calls use no-training APIs; `ai_usage` and memory tables cascade on account erasure.

---

## 2. Core Capabilities & Current Rules

### 2.1 Puhu Chat & Structured Memory (`/koc/sohbet`, `/v1/coach/chat*`)
- **Turn Planning (`CoachTurnPlanner`):** Deterministically selects turn intent, tone, up to 3 verified study facts (`usedEvidence`), and at most 1 user-confirmable Coaching action (`POST /v1/coach/messages/:id/action`).
- **Dual Rolling Quotas (`2026-11-04`, migration `0140`):** Premium chat (`chat`, `chat/stream`, `regenerate/stream`) enforces both `ai.chat.daily_limit` (rolling 24h) and `ai.chat.monthly_limit` (rolling 30d). Exhaustion returns `429 AI_CHAT_QUOTA_EXCEEDED` with `details.retryAt`; `GET /v1/coach/access` exposes `dailyMessagesRemaining`, `monthlyMessagesRemaining`, and `retryAt`.
- **Consent-Based Memory (`/v1/coach/profile`, `/v1/coach/memories`):** Stores only allowlisted, normalized facts when the student opts in; students can inspect, edit, or delete individual facts at any time.

### 2.2 `Puhu’yla planla` (Adaptive Planning & Coin Previews)
- **Premium Path:** `GET /v1/coach/plan-adaptation/brief` seeds the 4-step wizard (no model call); `POST /v1/coach/plan-adaptation` generates a non-mutating 7-day `MOVE`/`ADD` preview with `usedEvidence` (displayed on the falling-notes `.plan-coach-night` stage).
- **Coin Unlock Path (`/v1/coach/plan-previews/*`):** Opens the shared `UnlockChoice` sheet before the wizard (`200 Coin` default, 1 per rolling 24h). Reserves AI budget before generation and settles Coin only after a valid preview is persisted (`Idempotency-Key` required).

### 2.3 Weekly Recap (`Wrapped`) & Deep Analysis Narration (`/v1/coach/weekly-recaps/*`)
- **Single Owned Report (`2026-11-01..04`):** One acquisition (Premium, earned quest right, or `250 Coin` via `UnlockChoice`) generates and freezes both the Weekly Recap story narration and the `deepAnalysis` comparison snapshot (`schema-weekly-recaps.ts`).
- **Recommendation Follow-Up (`GET .../follow-up`, `POST .../plan-task`):** Turns the report's suggested focus subject into a tracked plan task and measures next week's progress without an extra LLM call.

### 2.4 Daily Greeting, Mood & Session Reflections, Ghost & Vision Notes
- **Per-Feature Concurrency & Regeneration Guards (`ai-generation-guard.ts`, `2026-11-05`):** Every generation service (`DailyGreetingService`, `MoodReflectionService`, `SessionReflectionService`, `GhostNarrationService`, `VisionNoteService`, `WeeklyReviewNarrationService`, `PlanAdaptationService`, `PhotoCategorizeService`, and Mentorship brief/suggestion services) runs inside `withUserFeatureLock` and enforces `assertWithinFeatureDailyCap`. Concurrent requests coalesce onto cache, and locale/state thrashing cannot bypass daily generation ceilings.

### 2.5 Budget & Kill-Switches
- **Global Kill-Switch:** `AI_PROVIDER=disabled` (env) or `ai.enabled=false` (admin config) disables all model calls cleanly (`GET /v1/app/availability` reports `aiCoach: false`).
- **Monthly Budget Cap:** `ai.budget.monthly_cap_usd_cents` reserves and settles estimated `cost_micros` in `ai_usage` across all LLM, embedding, and Vision calls (returning `503 AI_BUDGET_EXCEEDED` when reached).

---

## 3. API Surface

| Endpoint | Purpose |
|---|---|
| `GET /v1/coach/access` | Chat access mode (`PREMIUM`\|`COIN`\|`NONE`), daily/monthly remaining, `retryAt` |
| `POST /v1/coach/chat`, `POST /v1/coach/chat/stream` | Multi-turn or SSE streaming chat with Puhu |
| `POST /v1/coach/conversations/:id/regenerate/stream` | Regenerate last reply (SSE; shares chat quota) |
| `GET\|DELETE /v1/coach/conversations{,/:id,/:id/messages}` | Conversation list, message history, and thread deletion |
| `POST /v1/coach/messages/:id/action`, `PATCH .../feedback` | Accept/cancel suggested plan/session action; 👍/👎 feedback |
| `GET\|PATCH /v1/coach/profile`, `GET\|PATCH\|DELETE /v1/coach/memories{,/:id}` | Communication preferences and structured cross-thread memory |
| `GET /v1/coach/plan-adaptation/brief`, `POST /v1/coach/plan-adaptation` | Premium `Puhu’yla planla` wizard brief and 7-day adaptation preview |
| `GET /v1/coach/plan-previews/{access,brief,:id}`, `POST .../{,/:id/confirm}` | Coin-unlocked `Puhu’yla planla` preview & settlement |
| `GET /v1/coach/weekly-recaps/access`, `GET\|POST /v1/coach/weekly-recaps/*` | Owned Weekly Recap + Deep Analysis report & follow-up task |
| `POST /v1/coach/{daily-greeting,mood-reflection,ghost-narration,vision-note}` | Cached contextual Puhu reflections and notes |
| `GET /v1/coach/photo-access`, `POST /v1/mock-exams/:id/categorize-photo` | Vision topic classification (`VisionPort`) |
| `POST /v1/admin/ai/reembed`, `GET /v1/admin/metrics/{ai,coach-feedback}` | Admin RAG re-embedding, LLM spend metrics, and feedback stats |

---

## 4. Geliştirmeler (Condensed Milestone Timeline)

- **2026-11-05 — Per-Feature Concurrency Locks, Daily Regeneration Caps & Vision Settlement Order:** Added `ai-generation-guard.ts` (`withUserFeatureLock` + `assertWithinFeatureDailyCap`) across all 13 AI generation services, enforced embedding budget checks, validated notebook photo keys, and settled Vision `ai_usage` immediately after provider response.
- **2026-11-04 — Dual Daily/Monthly Premium Chat Quota & Combined Recap + Deep Analysis (`APP-135`):** Added `ai.chat.monthly_limit` alongside `daily_limit` (`0140_premium_chat_quota.sql`), unified Weekly Recap and Deep Analysis into one owned report, and added recommendation follow-up endpoints.
- **2026-11-01..03 — `UnlockChoice` Sheet for Wrapped & Plan Previews:** Built shared `UnlockChoice` (`components/unlock-choice.tsx`) for Coin/Premium unlocking of Weekly Recap (`250 Coin`) and `Puhu’yla planla` (`200 Coin`) with idempotent claim/settlement fences.
- **2026-10-29..30 — Provider Kill-Switch & Disabled-AI Startup:** Enabled zero-key startup when `AI_PROVIDER=disabled` and wired `AppAvailabilityDto.aiCoach`.
- **2026-09-23..26 — Adaptive Planning Brief & Mentorship Coach AI:** Shipped `plan-adaptation/brief` and human-coach AI briefs/homework suggestions (`MentorshipModule`).
- **2026-08-01..02 — Personalized Mentor V2 & Community Coach Bridge:** Shipped `CoachTurnPlanner`, consent-based structured `coach_memory_facts`, confirmable message actions, and `/v1/forum/threads/:id/coach-bridge`.
- **2026-07-15..20 — W3 MVP Foundation (`0012–0014`):** Shipped `LlmPort`/`VisionPort`, SSE streaming, pgvector RAG, official-info data card interceptor, and OpenAI Responses API eval suite.
