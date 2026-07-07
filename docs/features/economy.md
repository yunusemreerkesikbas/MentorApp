# Economy

> Light append-only ledger substrate: XP reputation + non-monetary Coin (→ earned AI right). Module:
> `modules/economy`. Workstream: W6. Roadmap: MVP light substrate shipped; Phase 2 adds
> habit/milestone quests, coin reversal, real economy expansion.

## Overview

The economy is an append-only ledger system for XP (reputation) and Coin (non-monetary, capped, earned
right → AI chat access). It powers onboarding quests, invite rewards, and AI chat spending. **Coin is
non-monetary, capped. Never in chat UI (§4 #3). The ledger never stores a single number / never deletes.**

## Architecture (key decisions)

- **Append-only ledger** (`ledger_entries`): `unit` (XP|COIN), signed `amount`, `status`
  (PENDING|CONFIRMED|REVERSED, default CONFIRMED), `ref_type/ref_id` (idempotent event grants).
  **Balance = sum of rows, never a single number.** No UPDATE/DELETE RLS policy ⇒ immutable.
- **Capped earning:** rolling 24h/7d coin caps + minimum XP threshold for coin earning (anti-Sybil).
  Config from the central registry: `economy.coin.{daily_cap, weekly_cap, min_xp_for_coin}`.
- **Idempotent grants:** unique `(ref_type, ref_id)` where `ref_id` not null.
- **Spending:** `EconomyService.spend()` — atomic confirmed-coin debit, idempotent on ref.
  `INSUFFICIENT_COIN` (422). Free daily coin allowance for AI chat (separate from premium rate-limit).
- **Cross-module decoupling:** economy consumes events from payments (`subscription.activated`) and
  emits events consumed by itself (invite conversion). Forum XP is wired via `forum.answer.accepted`.
  **No runtime dependency on economy from forum** (type-only import).
- **Gated by `economy.enabled`** (default off) — dormant until admin flips the flag.

## Tutorials / Guides

```bash
# Enable economy (admin):
PATCH /v1/admin/config/economy.enabled { "value": true }

# Grant coin (system/other modules):
await economy.grant(userId, Currency.COIN, 10, { reason: "invite.converted", refType: "invite", refId });

# User: check balance, quests, invite code:
GET /v1/economy/balance       # { xp, coin, ... }
GET /v1/economy/quests        # catalog + progress (auto-grants newly completed)
GET /v1/economy/invite        # { code }
POST /v1/economy/invite/redeem { "code": "..." }   # PENDING

# AI chat spend (see ai.md for full flow):
GET /v1/coach/access          # { mode: PREMIUM|COIN|NONE, ... }
POST /v1/coach/chat { "message": "...", "clientMessageId": "<uuid>" }

# Admin: manual adjust (bypasses caps, audited):
GET /admin/users/:id/economy
POST /admin/users/:id/economy/adjust { "unit": "COIN", "amount": 30, "reason": "..." }

# Web: profil earn hub — http://localhost:3000/profil
# Hidden when economy.enabled=false
```

## API

| Endpoint | Purpose |
|---|---|
| `GET /v1/economy/balance` | Self balance + ledger |
| `GET /v1/economy/ledger` | Self ledger history |
| `GET /v1/economy/quests` | Quest catalog + progress (auto-grants) |
| `GET /v1/economy/invite` | Get/generate invite code |
| `POST /v1/economy/invite/redeem` | Redeem invite code |
| `POST /v1/admin/users/:id/economy/adjust` | Admin manual adjust (audited) |

## Geliştirmeler (timeline)

- **Slice 1 — Ledger substrate + admin adjust** — `ledger_entries`, `EconomyService.grant()`
  (append-only, capped), self balance/ledger API, admin manual adjust (audited, bypasses caps).
  *(0021.)*
- **Slice 2a — Invite → conversion → coin** — `invites` + `invite_redemptions`, stable code per user,
  conversion listener on `payments.subscription.activated`, inviter coin reward (idempotent, capped).
  F1 fix: cap-check + append in one tx (TOCTOU race closed). *(0022.)*
- **Onboarding quests** — 4 auto-grant quests (profile-setup, email-verified, first-subscription,
  invite-redeemed), `user_quest_progress`, lazy-eval triggers (GET + event hooks), admin quest view.
  *(0027.)*
- **Coin → AI chat spend** — `EconomyService.spend()`, `GET /coach/access`, free daily coin allowance,
  LLM-failure compensating refund. *(0045.)*
- **Web profil economy UI** — earn hub on `/profil` (balance, quests, invite share + redeem).
  Hidden when `economy.enabled=false`. *(0046.)*
- **Profil görev sheet iyileştirmesi** — `GET /v1/economy/quests` artık görev başına `rewardCoin`
  döndürür; `/profil` görev sheet'i tamamlanma özetini, Framer Motion animasyonlu yarım daire
  progress gauge'ini, backend'den gelen Coin ödülünü ve abonelik/davet aksiyonlarını gösterir.
  Tamamlanan görevlerde metin rozet yerine soluk yeşil tick yeterlidir; eksik görevlerde satırın kendisi
  aksiyon olur. E-posta doğrulama satırı `POST /v1/users/me/verification-email` ile doğrulama mailini
  yeniden gönderir. Kart-içinde-kart görünümü kaldırıldı; ödül hâlâ otomatik işlenir, manuel claim yok.
  İlgili dosyalar: `QuestService`, `@mentor/types` economy contract, `economy-quests-card.tsx`.
  *(2026-07-05.)*
- **Quest v2 — günlük ritüel görevleri** — `GET /v1/economy/quests` artık onboarding görevlerine ek
  olarak günlük tekrar eden üç ritüel görevi döndürür: bugünün planından bir görev tamamla, bir odak
  seansı bitir, mood check-in yap. Contract `category`, `period`, `periodKey`, `rewardUnit`,
  `rewardAmount`, `badgeLabel` ve `action` alanlarıyla genişledi; eski `rewardCoin` alanı geriye
  uyumluluk için kaldı. Günlük görevler `+5 XP` verir (`economy.quest.daily_ritual_reward_xp`),
  onboarding görevleri Coin vermeye devam eder. `user_quest_progress.period_key` günlük idempotency
  sağlar (`once` vs `YYYY-MM-DD`). Quest completion + ledger reward aynı SERVICE transaction içinde
  işlenir; progress okumaları sadece `once` ve bugünün period key'i ile sınırlıdır. Economy, coaching
  tablolarını okumaz; `DailyQuestSignalService` üzerinden boolean sinyal alır. Web modalı iki bölüme
  ayrıldı: "Bugünkü Ritüel" + "Başlangıç"; görev listesi kendi içinde scroll eder ve navigasyon
  aksiyonları sheet'i kapatır.
  üstte tek "sıradaki küçük adım" CTA'sı bulunur. *(2026-07-06.)*

## Gotchas / Known issues

- **Caps are rolling windows** (now−24h / now−7d), not calendar — simple, TZ-free.
- **Admin adjust bypasses caps** (`enforceLimits:false`) — it's a correction; organic earning passes
  caps.
- **Invite: forward-only** — reward fires only on conversion AFTER redeem. Premium-at-redeem rejected.
- **Free daily coin cap** counts ledger rows with `reason=ai.chat.spend` in rolling 24h.
- **LLM fail after spend** → compensating `ai.chat.refund` grant (logged if refund fails).
- **Churn/refund reversal** = Phase 2 (negative compensating entry).
- **F1 (backlog — REQUIRED before more organic earning):** cap check + append are atomic now
  (fixed in 0022), but advisory-lock = backlog for extreme concurrency.
- **Milestone quests** = backlog (streak tiers / longer-term badges need a broader product pass).

## Related

- Seam: [ai.md](./ai.md) (coin spend), [forum.md](./forum.md) (XP on accepted answer),
  [payments.md](./payments.md) (subscription event), [admin.md](./admin.md) (config/economy UI)
- Status: [core/mvp-status.md](../core/mvp-status.md) (W6 breakdown)
