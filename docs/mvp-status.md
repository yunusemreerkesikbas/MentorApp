# MVP Status Report

> One-page snapshot of what's built vs pending for the MVP (Phase 1). Detail per item → linked
> devnote. Track ownership/sequencing → [`workstreams.md`](./workstreams.md). Product scope → roadmap.
> Status: ✅ done · 🟡 partial · ⏳ pending (MVP) · ⛔ Phase 2.

## Done / In progress by workstream

| Track | Status | Shipped | Pending (MVP) |
|---|---|---|---|
| **Base infra** | ✅ | db (pg Pool) · errors · i18n · logging · health · OpenAPI · tests ([0007](./devnotes/0007-base-infrastructure.md), [0008](./devnotes/0008-base-review-fixes.md)) | — |
| **W0 Identity** | ✅ | JWT + refresh rotation, RLS policies, guards, web auth screens ([0010](./devnotes/0010-identity.md), [0011](./devnotes/0011-identity-review-fixes.md)), auth UI polish ([0036](./devnotes/0036-web-auth-ui-polish.md)) | — |
| **W1 Content** | 🟡 | exam calendar ([0016](./devnotes/0016-w1-exam-calendar.md)) · knowledge center ([0017](./devnotes/0017-w1-knowledge-center.md)), **bilgi UI polish** ([0039](./devnotes/0039-w1-web-bilgi-ui-polish.md)) · subjects/exam-subjects · exam-calendar admin editor ([0024](./devnotes/0024-w6-admin-exam-calendar-editor.md)) · pgvector RAG embeddings ([0043](./devnotes/0043-w3-ai-rag-grounding.md)) | — (HNSW index at scale = backlog) |
| **W2 Coaching** | 🟡 | daily loop · panel ([0013](./devnotes/0013-panel-daily-hub.md), [0014](./devnotes/0014-w2-coaching-daily-loop.md), UI polish [0033](./devnotes/0033-w2-web-panel-ui-polish.md)) · plan/seans UI polish ([0037](./devnotes/0037-w2-web-plan-seans-ui-polish.md)) · mock-exam **analiz** UI polish ([0038](./devnotes/0038-w2-web-analiz-ui-polish.md)) · **web profil** (exam-type picker, account hub) ([0032](./devnotes/0032-w3-web-profil-ui.md)) · **mood: struggle-note + premium AI-adaptive reflection** ([0048](./devnotes/0048-w3-mood-ai-adaptive.md)) · **ghost (geçmiş-ben) comparison + premium AI narration** ([0049](./devnotes/0049-w2-ghost-comparison-ai-narration.md)) · **hayal/hedef panosu + premium AI notu** ([0051](./devnotes/0051-w2-vision-board.md)) | — (MVP feature set complete) |
| **W3 AI** | 🟡 | premium AI coach chat ([0030](./devnotes/0030-w3-ai-coach-chat-slice1.md)) + **web koç UI** (`/koc`, ephemeral transcript, premium gate) ([0031](./devnotes/0031-w3-web-koc-ui.md), UI polish [0034](./devnotes/0034-w3-web-koc-ui-polish.md)) · **RAG grounding + source links** ([0043](./devnotes/0043-w3-ai-rag-grounding.md)) · **coin→AI chat spend** ([0045](./devnotes/0045-w3-coin-ai-chat-spend.md)) · **photo→subject categorize** ([0047](./devnotes/0047-w3-photo-subject-categorize.md)) · **mood AI-adaptive reflection + mood grounding in coach context** ([0048](./devnotes/0048-w3-mood-ai-adaptive.md)) · **ghost AI narration** ([0049](./devnotes/0049-w2-ghost-comparison-ai-narration.md)) | multi-turn/streaming, topic-level vision |
| **W4 Payments** | ✅ | PaymentsPort fake/iyzico, trial state machine, entitlement + PremiumGuard, idempotent webhook, /abonelik ([0015](./devnotes/0015-payments.md)), **abonelik UI polish** ([0040](./devnotes/0040-w4-web-abonelik-ui-polish.md)) | iyzico prod keys + e-archive (Phase-0 ops) |
| **W5 Notifications** | ✅ | JobQueuePort + cron runner, Postmark email, web push, daily reminders ([0019](./devnotes/0019-w5-notifications-queue.md)) | — |
| **W6 Admin + Economy** | ✅ | see breakdown below — all MVP slices shipped | Phase 2: moderation queue · habit/milestone quests |

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
| Exam-calendar editor: exam upsert + calendar events upsert/delete (ADMIN/EDITOR, trust metadata) | ✅ | [0024](./devnotes/0024-w6-admin-exam-calendar-editor.md) |
| Refund + subscription admin view (record-only refund + cancel, ADMIN, audited) | ✅ | [0025](./devnotes/0025-w6-admin-refund-subscription.md) |
| Metrics dashboard (users + subscriptions/revenue + economy KPI snapshot, ADMIN) | ✅ | [0026](./devnotes/0026-w6-admin-metrics-dashboard.md) |
| Economy: onboarding quests (auto-grant, capped, idempotent; habit/milestone backlog) | ✅ | [0027](./devnotes/0027-w6-economy-quests.md) |
| Economy: coin spend → AI chat (`EconomyService.spend`; integrated by W3) | ✅ | [0045](./devnotes/0045-w3-coin-ai-chat-spend.md) |
| Fine admin sub-roles (SUPPORT/FINANCE/SUPER_ADMIN gating + assignment; MODERATOR reserved) | ✅ | [0028](./devnotes/0028-w6-admin-sub-roles.md) |
| Moderation queue (forum/community content) | ⛔ | needs forum (Phase 2) |

## Cross-cutting / known issues
- **B2C web landing** (`/`) — marketing hero + **KPSS editorial links** ([0035](./devnotes/0035-web-landing-page.md), [0039](./devnotes/0039-w1-web-bilgi-ui-polish.md)).
- **B2C web auth** (`/giris`, `/kayit`, …) — Nuton shell + motion polish ([0036](./devnotes/0036-web-auth-ui-polish.md)); aligned with landing funnel CTAs.
- **B2C app shell** — tab bar / sidebar nav polish + `/panel` vs `/plan` active fix ([0041](./devnotes/0041-web-app-shell-nav-polish.md)).
- **B2C web UI polish** — series complete; cross-cutting sweep ([0042](./devnotes/0042-web-b2c-ui-polish-sweep.md)).
- **B2C web i18n (TR/EN)** — URL-based next-intl; tüm FE static copy `useTranslations`/`getTranslations`, statik
  render + public ISR ([0050](./devnotes/0050-web-i18n-next-intl.md)). Yeni FE işleri localize yapılır (frontend.md §i18n).
- **`apps/admin` not yet committed** — to be sent as a separate commit/PR (per owner).
- **B2C web economy/invite UI** (`apps/web`) — earn hub on `/profil` (balance, quests, invite) ([0046](./devnotes/0046-web-profil-economy-ui.md)); ledger history UI = slice 2 backlog. Requires `economy.enabled=true`.
- **Migration journal drift** — RECONCILED ([0048](./devnotes/0048-w3-mood-ai-adaptive.md)): re-added the
  missing `0006_info_articles` journal entry and restored the HEAD snapshot (`meta/0017_snapshot.json`)
  so `db:generate` emits only new deltas. Policy: commit each migration **with its snapshot + a real
  timestamp**, forward-only. Caveat: a local DB that already skipped 0006 won't auto-apply it (drizzle
  applies `when > last`) — apply `0006_info_articles.sql` once by hand if `info_articles` is missing.
- **Economy reconcile** — invite reward on transient grant failure isn't retried (cap denial is by
  design); outbox/retry = Phase 2. Coin reversal (churn/refund) = Phase 2.
- **Local RLS masking** — local `mentor` DB user is superuser → RLS bypassed locally; always verify
  RLS-sensitive reads (admin drafts, etc.) run in the right context (caught for content editor).

## Guardrails honored (AGENTS §4)
Coin non-monetary/capped · append-only ledgers (never edited/deleted) · reward tied to verified action ·
no coin in chat · LLM never generates official info (editorial + trust metadata) · every admin mutation
audited · org/coach-ready schema · KVKK erasure via anonymization.
