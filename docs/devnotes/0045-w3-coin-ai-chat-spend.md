# 0045 — W3 · Coin → AI Coach Chat Spend (Slice 1)

> Date: 2026-06-18 · Scope: api (economy spend + ai access/chat) + web `/koc` gate · Related: roadmap §3/§7/§10,
> AGENTS §4 (#3/#4), workstreams W3/W6. Builds on [0030](./0030-w3-ai-coach-chat-slice1.md),
> [0043](./0043-w3-ai-rag-grounding.md), [0021](./0021-w6-light-economy.md).

## What was done
- **Economy spend:** `EconomyService.spend()` — atomic confirmed-coin debit, idempotent on `(refType, refId)`;
  `INSUFFICIENT_COIN` (422). Ledger helper `coinChatSpendsSince` for the free-coin daily cap.
- **Config:** `economy.coin.ai_chat_cost` (default 5) · `ai.chat.free_coin_daily_limit` (default 5). Premium keeps
  `ai.chat.daily_limit` (30); premium never spends coin.
- **AI access:** `GET /v1/coach/access` → `{ canChat, mode: PREMIUM|COIN|NONE, reason?, chatCost?, freeCoinMessagesRemainingToday? }`.
  `PremiumGuard` removed from chat; `ChatService` orchestrates premium vs coin paths.
- **Coin path:** requires `economy.enabled`; debits before LLM; LLM failure → compensating `ai.chat.refund` grant.
  Optional `clientMessageId` on `POST /v1/coach/chat` for idempotent spend.
- **Web `/koc`:** loads access probe; `COIN`/`PREMIUM` → chat UI; `NONE` → gate (no coin in composer/transcript §4 #3).

## How to use (usage)
```bash
# Enable economy (admin): PATCH /v1/admin/config/economy.enabled { "value": true }
# Grant test coin (admin FINANCE adjust) or complete quests → GET /v1/economy/quests
# Probe: GET /v1/coach/access
# Chat (free): POST /v1/coach/chat { "message": "…", "clientMessageId": "<uuid>" }
# Premium: same endpoint — no coin debit
pnpm --filter @mentor/api test -- ai-coach
```

## Gotchas
- **`economy.enabled` default false** — coin path dormant until flipped; access returns `NONE` + `PAYMENT_PREMIUM_REQUIRED`.
- **Coin never in chat UI** (§4 #3) — access fields are for gate screens only; chat response has no balance fields.
- **Free daily cap** counts ledger rows with `reason=ai.chat.spend` in rolling 24h — separate from premium `ai_usage` cap.
- **LLM fail after spend:** refund via `grant` (`ai.chat.refund`, ref `ai_chat_refund` + spend refId); logged if refund fails.
- **Idempotent spend:** duplicate `(ai_chat, clientMessageId)` skips debit but still runs LLM (MVP — no response cache).
- **Refund scope:** compensating refund runs only when this request performed a **new** spend (`!alreadySpent`); idempotent retries must not refund after an earlier successful debit.

## Related files & decisions
- `apps/api/src/modules/economy/{application/economy.service.ts, infrastructure/ledger.repository.ts, domain/economy.constants.ts}`
- `apps/api/src/modules/ai/{application/coach-access.service.ts, application/chat.service.ts, presentation/ai-chat.controller.ts, ai.module.ts}`
- `packages/types/src/ai.ts` · `packages/validation/src/ai.ts`
- `apps/web/src/{lib/coach.ts, app/(app)/koc/_components/{koc-shell,coach-access-gate}.tsx}`
- **Verified:** unit `economy.service.spec` (spend/idempotent) · unit `chat.service.spec` (refund scope / idempotent retry) · e2e `ai-coach` (premium/coin/insufficient/caps/idempotency).
