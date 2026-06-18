# 0030 — W3 · AI Coach Chat (Slice 1, lean / refusal-grounded)

> Date: 2026-06-16 · Scope: api (new `modules/ai`) + schema/migration + config/env/validation · Related:
> roadmap §1, AGENTS §4 (#1/#4/#6), §7 cost cap, workstreams W3. First W3 slice.

## What was done
- New bounded context `apps/api/src/modules/ai/**`: **premium-gated, single-turn AI coach chat**.
  `POST /v1/coach/chat` → `{ reply, model }`. No conversation history; no vector RAG yet.
- **LlmPort** (`domain/llm.port.ts`) with two adapters, selected by `AI_PROVIDER` env (PaymentsPort
  pattern): `FakeLlmAdapter` (dev/test default — deterministic reply + estimated tokens) and
  `OpenAiLlmAdapter` (real, fetch-based, **no new dependency**; needs `OPENAI_API_KEY`, else
  `AI_PROVIDER_ERROR`).
- **§4 #1 (hardest guardrail):** with no RAG, the system prompt FORBIDS generating official info
  (dates/process/placement) and redirects to `/bilgi` + the data card — no hallucination. RAG-grounded
  answers land in Slice 2 (embedding column + `ArticlePublished` seam already exist).
- **§4 #6 PII-free:** `ContextBuilder` sends only `examType` + countdown (`UsersService.getMe` +
  `ContentService.getExamCalendarByFamily`) — never email/name/behavioral data.
- **§4 #4:** `PremiumGuard` (free → 403). **`ai.enabled`** flag = global kill-switch (→ 404 `AI_DISABLED`).
- **§7 cost cap:** every call writes an `ai_usage` row (model + tokens + estimated `cost_micros`);
  premium **daily rate-limit** (`ai.chat.daily_limit`, default 30) via `countSince` → 429 `AI_RATE_LIMITED`.

## How to use (usage)
```bash
# dev (AI_PROVIDER=fake default): premium/STAFF user
curl -X POST /v1/coach/chat -H 'Authorization: Bearer <token>' -d '{"message":"Nasıl çalışmalıyım?"}'
# prod: set AI_PROVIDER=openai + OPENAI_API_KEY (+ optional OPENAI_MODEL, default gpt-4o-mini)
# kill-switch / cap: admin PATCH /v1/admin/config/ai.enabled · /v1/admin/config/ai.chat.daily_limit
```

## Gotchas
- **No RAG (Slice 1):** the coach cannot answer official-info questions — it refuses + points to the
  knowledge center. This is the §4 #1 guarantee until RAG retrieval lands (Slice 2).
- **One migration:** `ai_usage` is a **metering** table (tokens/cost), NOT chat history — consistent with
  single-turn. RLS self-read + SERVICE; writes/counts in SERVICE context. (`db:generate` + snapshot, applied dev/test.)
- **Rate-limit window** is rolling 24h (`now − 24h`), not calendar-day; simple + abuse-resistant.
- **Cost** = `tokens × per-model micro-USD` (estimate table in `ai.constants.ts`); fake = 0. Metrics
  LLM-cost can sum `ai_usage.cost_micros` later (was deferred in 0026).
- **No new dependency:** OpenAI adapter uses `fetch`; it's a skeleton (won't run without a key; fake is default).
- **Prod note:** `AI_PROVIDER=openai` requires `OPENAI_API_KEY` (env lock). AI also gated by `ai.enabled`,
  so prod may ship with fake until the key/launch is ready — keep `ai.enabled=false` until then.

## Related files & decisions
- `apps/api/src/modules/ai/{domain/llm.port.ts, domain/ai.constants.ts, application/context-builder.service.ts,
  application/chat.service.ts, infrastructure/ai-usage.repository.ts, infrastructure/adapters/*, presentation/*, ai.module.ts}`
- `apps/api/src/database/schema.ts` (`ai_usage`) · `drizzle/0015_jittery_leopardon.sql`
- `config/env.validation.ts` (AI_PROVIDER/OPENAI_MODEL + lock) · `common/config/config.catalog.ts`
  (`ai.chat.daily_limit`, AI category) · `error-code.ts` (+i18n) · `packages/validation/src/ai.ts` (`aiChatSchema`)
- **Verified:** e2e `ai-coach` (free 403 · premium 201 + usage metered · ai.enabled=false 404 · rate-limit 429 ·
  §4 #1 refusal asserted on the prompt); api lint+typecheck green.
- Decisions (owner): lean chat (RAG = Slice 2); OpenAI real + fake default; single-turn stateless; token/cost
  log + premium rate-limit.

## Backlog (next slices)
- Vector RAG over `info_articles.embedding` (embed on `ArticlePublished` + backfill + retrieval + source links).
- Web koç UI (apps/web `/koc`). · Multi-turn + conversation history. · coin→AI spend (economy debit).
- Streak/mood context grounding (needs coaching export). · photo→categorize (vision). · Gemini adapter.
