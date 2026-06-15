# MVP Status Report

> One-page snapshot of what's built vs pending for the MVP (Phase 1). Detail per item → linked
> devnote. Track ownership/sequencing → [`workstreams.md`](./workstreams.md). Product scope → roadmap.
> Status: ✅ done · 🟡 partial · ⏳ pending (MVP) · ⛔ Phase 2.

## Done / In progress by workstream

| Track | Status | Shipped | Pending (MVP) |
|---|---|---|---|
| **Base infra** | ✅ | db (pg Pool) · errors · i18n · logging · health · OpenAPI · tests ([0007](./devnotes/0007-base-infrastructure.md), [0008](./devnotes/0008-base-review-fixes.md)) | — |
| **W0 Identity** | ✅ | JWT + refresh rotation, RLS policies, guards, web auth screens ([0010](./devnotes/0010-identity.md), [0011](./devnotes/0011-identity-review-fixes.md)) | — |
| **W1 Content** | 🟡 | exam calendar ([0016](./devnotes/0016-w1-exam-calendar.md)) · knowledge center ([0017](./devnotes/0017-w1-knowledge-center.md)) · subjects/exam-subjects | pgvector RAG index (with W3); exam calendar admin editor |
| **W2 Coaching** | 🟡 | daily loop · panel ([0013](./devnotes/0013-panel-daily-hub.md), [0014](./devnotes/0014-w2-coaching-daily-loop.md)) · plan/seans UI · mock-exam analysis | mood polish, vision board / ghost (per roadmap) |
| **W3 AI** | ⏳ | — (PremiumGuard + ContentPort + economy coin ready as inputs) | Context Builder, LLM/RAG, AI chat, photo→categorize, **coin→AI-right spend** |
| **W4 Payments** | ✅ | PaymentsPort fake/iyzico, trial state machine, entitlement + PremiumGuard, idempotent webhook, /abonelik ([0015](./devnotes/0015-payments.md)) | iyzico prod keys + e-archive (Phase-0 ops) |
| **W5 Notifications** | ✅ | JobQueuePort + cron runner, Postmark email, web push, daily reminders ([0019](./devnotes/0019-w5-notifications-queue.md)) | — |
| **W6 Admin + Economy** | 🟡 | see breakdown below | refund · metrics · moderation · exam-calendar editor · economy quests/spend |

## W6 breakdown (this stream's focus)
| Slice | Status | Devnote |
|---|---|---|
| Admin module foundation: STAFF assignment + append-only audit log (table + interceptor) | ✅ | [0018](./devnotes/0018-w6-admin-foundation.md) |
| Admin UI shell: Duralux app → `apps/admin`, pnpm-integrated, hybrid TS, auth guard/login/logout, branding | ✅ | [0018](./devnotes/0018-w6-admin-foundation.md) |
| User management: search/detail, graduated status (suspend/ban), KVKK export + anonymize | ✅ | [0018](./devnotes/0018-w6-admin-foundation.md) |
| Config registry + feature flags (typed catalog + DB overrides + cache, admin `/config`) | ✅ | [0020](./devnotes/0020-w6-config-registry.md) |
| Light economy substrate: append-only XP/Coin ledger, capped reward engine, admin manual adjust | ✅ | [0021](./devnotes/0021-w6-light-economy.md) |
| Light economy: invite → conversion → coin (idempotent, capped) | ✅ | [0022](./devnotes/0022-w6-light-economy-invite.md) |
| Content editor: knowledge-center article CRUD + publish/unpublish (ADMIN/EDITOR, trust metadata) | ✅ | [0023](./devnotes/0023-w6-admin-content-editor.md) |
| Refund + subscription admin view | ⏳ | — |
| Metrics dashboard (retention/conversion/LLM-cost) | ⏳ | — |
| Economy: onboarding/habit/milestone quests | ⏳ | — |
| Exam-calendar editor (admin) | ⏳ | — |
| Fine admin sub-roles (MODERATOR/SUPPORT/FINANCE/SUPER_ADMIN) | ⏳ | coarse ADMIN/EDITOR/STAFF live |
| Moderation queue (forum/community content) | ⛔ | needs forum (Phase 2) |

## Cross-cutting / known issues
- **`apps/admin` not yet committed** — to be sent as a separate commit/PR (per owner).
- **B2C web economy/invite UI** (`apps/web`) — backend APIs ready (`/economy/*`); user-facing screens
  are a separate frontend task, **not scheduled**.
- **Migration journal drift** — parallel tracks shipped migrations without snapshots / with future
  `when` timestamps, causing skipped migrations on local DBs (info_articles, etc.). Team action: commit
  each migration **with its snapshot + real timestamps**; reconcile local dev journals.
- **Economy reconcile** — invite reward on transient grant failure isn't retried (cap denial is by
  design); outbox/retry = Phase 2. Coin reversal (churn/refund) = Phase 2.
- **Local RLS masking** — local `mentor` DB user is superuser → RLS bypassed locally; always verify
  RLS-sensitive reads (admin drafts, etc.) run in the right context (caught for content editor).

## Guardrails honored (AGENTS §4)
Coin non-monetary/capped · append-only ledgers (never edited/deleted) · reward tied to verified action ·
no coin in chat · LLM never generates official info (editorial + trust metadata) · every admin mutation
audited · org/coach-ready schema · KVKK erasure via anonymization.
