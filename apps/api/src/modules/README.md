# modules — Bounded Contexts (§8 module map)

Modular monolith. **Rule:** modules never touch each other's tables; they talk via a public interface
or a **domain event** (NestJS `EventEmitter`; moves to a queue if they split out).

**Pragmatic Clean (§8):** layer depth scales with the work. Simple CRUD (read an article) →
controller+service+repo. Critical domain (economy/payments/ai/forum-verification) →
full layering (domain/application/infrastructure/presentation).

| Module | Responsibility | Phase |
|---|---|---|
| `identity` | User, role (STUDENT/COACH/ORG_ADMIN/EDITOR/ADMIN), org, own JWT auth | MVP |
| `coaching` | AI-coach backbone: plan, check-in, ritual/Pomodoro, mock analysis, ghost, vision board | MVP |
| `ai` | Context Builder + Memory Profile + LLM/RAG orchestration (Ports & Adapters) | MVP |
| `content` | Knowledge-center A-layer (InfoArticle + trust metadata), calendar, pgvector RAG source | MVP |
| `payments` | iyzico subscription/trial/refund, e-archive, idempotent webhook, entitlement | MVP |
| `notifications` | web push + email (Postmark), contextual/scheduled notifications, `JobQueuePort` jobs | MVP |
| `admin` | Lean admin: content editor, user management, refund, metrics, audit, feature flags, config registry | MVP |
| `economy` | XP/Coin ledger (append-only), quests/invites, abuse shields | Phase 2 |
| `forum` | 3 zones (knowledge/chat/study-room), verification hierarchy, C-layer | Phase 2 |
| `community` | Neighborhood (cohort), presence/leaderboard (Redis), live study room | Phase 2 |
| `marketplace` | Coach discovery/commission/chat (to be added) | Phase 3 |

Each module is imported into `app.module.ts` as it's implemented. For now only `health` is active;
the folders below reserve the bounded-context boundaries.
