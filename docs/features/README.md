# Features — Module Documentation

> Each bounded context (module) gets one short, clear, explanatory doc. What it does, how it's
> architected, how to use it, its API surface, development timeline, gotchas, and cross-references.
> Core/platform docs: [`../core/`](../core/README.md).

## Modules (MVP)

| Feature | Module | Status | Doc |
|---|---|---|---|
| Identity | `modules/identity` | ✅ | [identity.md](./identity.md) |
| Content | `modules/content` | 🟡 | [content.md](./content.md) |
| Coaching | `modules/coaching` | 🟡 | [coaching.md](./coaching.md) |
| AI | `modules/ai` | 🟡 | [ai.md](./ai.md) |
| Payments | `modules/payments` | ✅ | [payments.md](./payments.md) |
| Notifications | `modules/notifications` | ✅ | [notifications.md](./notifications.md) |
| Admin | `modules/admin` | ✅ | [admin.md](./admin.md) |
| Economy | `modules/economy` | ✅ | [economy.md](./economy.md) |
| Ads | `modules/ads` | 🟡 | [ads.md](./ads.md) |
| Forum | `modules/forum` | ✅ | [forum.md](./forum.md) |

## Cross-cutting

| Feature | Scope | Doc |
|---|---|---|
| Web shell | app nav, landing, B2C sweep | [web-shell.md](./web-shell.md) |
| i18n | next-intl TR/EN | [i18n.md](./i18n.md) |
| YKS 3D campus + preference simulation | content + coaching + web | [preference-simulation.md](./preference-simulation.md) |

## Phase 2/3 (not yet built)

`community` · `marketplace` — no code or devnote coverage yet. Documented here when development starts.

## How to add entries

After meaningful development, append a dated entry under "Geliştirmeler (timeline)" in the matching
feature doc. Format: **what · how to use · gotchas · related files**. Short and clear.
