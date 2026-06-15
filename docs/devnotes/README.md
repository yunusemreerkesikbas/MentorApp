# Devnotes — Development Log (usage / tutorial / devnotes)

> **Rule (binding):** After every meaningful development, leave a **short, clear, explanatory** note here.
> Purpose: a living usage/tutorial record → faster onboarding, agents find context, the "why" isn't lost.

## When to leave a note
- New module/feature/endpoint · new package or integration · architecture decision · schema/migration ·
  a gotcha worth flagging.
- Not needed for trivial changes (typo, formatting).

## How
1. Copy `_template.md` → `NNNN-kebab-title.md` (next number, 4 digits: `0003-identity-auth.md`).
2. Keep it short: **what was done · how to use · gotchas · related files/decisions.** Quick reference, not an essay.
3. Include it in the PR (review checks for the devnote — [code-review.md](../standards/code-review.md)).

## Format
- **Language:** English, bullet points. Short snippet if a code example is needed.
- **Links:** relevant roadmap section (§x), standard, file path.
- Numbers increase; files are **not deleted** (historical record) — if wrong, add a correction note.

## Index
| # | Title | Scope |
|---|---|---|
| [0001](./0001-project-initialization.md) | Project initialization | Monorepo skeleton, apps, packages, queue/RLS decisions |
| [0002](./0002-standards-and-conventions.md) | Standards & naming | code-style/api + backend/frontend/mobile/code-review standards |
| [0003](./0003-docs-english-refactor.md) | Docs & comments → English | engineering docs + code comments translated; roadmap stays Turkish |
| [0004](./0004-engineering-principles.md) | Engineering principles | SOLID/DRY/KISS/YAGNI, fallbacks, logic-backend-only, localized messages, Definition of Done |
| [0005](./0005-readme-turkish-overview.md) | README → Turkish overview | README summarizes the roadmap (Turkish, product-facing); setup moved to docs/setup.md |
| [0006](./0006-gitignore-and-repo-hygiene.md) | .gitignore & repo hygiene | skill libs ignored (~486→109 tracked files), LICENSE added, per-app gitignore removed |
| [0007](./0007-base-infrastructure.md) | Core/base infrastructure | db(pg Pool)/errors/i18n/logging/security/OpenAPI/health/tests; dual-driver → single driver |
| [0008](./0008-base-review-fixes.md) | Base review fixes | health filter exclusion, Swagger prod-gate, CORS env, validation i18n, Sentry instrument, negative e2e |
| [0009](./0009-workstreams.md) | Workstreams | MVP split into 7 parallel tracks with exclusive ownership + shared-file rules |
| [0010](./0010-identity.md) | W0 · Identity | own JWT + refresh rotation/reuse-detect, RLS policies, guards, orval client, web auth screens |
| [0011](./0011-identity-review-fixes.md) | W0 review fixes | throttler was a no-op (fixed+verified), examDate 500, signup race, KVKK cast cleanup |
| [0012](./0012-design-infrastructure.md) | Design infrastructure | @mentor/ui React primitives, fonts (latin-ext), responsive shell (tab bar ↔ sidebar) |
| [0013](./0013-panel-daily-hub.md) | Panel daily hub UI | /panel ritual screen + 6 ui primitives (W2 slice, mock-backed) |
| [0014](./0014-w2-coaching-daily-loop.md) | W2 · Coaching daily-loop | plan tasks · calm countdown · sessions · read-time streak · mood (rule-based); ContentPort, RLS |
| [0015](./0015-payments.md) | W4 · Payments | PaymentsPort fake/iyzico, trial-once state machine, entitlement+PremiumGuard, /abonelik |
| [0016](./0016-w1-exam-calendar.md) | W1 · Exam calendar (Slice 1) | editorial exams/exam_events, public calendar API, ContentPort adapter, Bilgi data card |
| [0017](./0017-w1-knowledge-center.md) | W1 · Knowledge center (Slice 2) | info_articles, ArticlePublished event, public SEO `/bilgi/[slug]`, hub article list |
| [0018](./0018-w6-admin-foundation.md) | W6 · Admin foundation | STAFF assignment + audit log (table+interceptor), admin module, Duralux admin UI (Bootstrap/JS) |
| [0019](./0019-w5-notifications-queue.md) | W5 · Notifications + Queue | JobQueuePort Postgres adapter, cron runner, Postmark email, web push, daily reminders |
| [0020](./0020-w6-config-registry.md) | W6 · Config Registry + Feature Flags | code catalog + config_overrides + cache, ConfigRegistryService, admin /config UI, flags (ai/economy/signup) |
| [0021](./0021-w6-light-economy.md) | W6 · Light Economy (Slice 1) | append-only ledger_entries (XP/Coin), EconomyService (capped grant), user balance/ledger API, admin manual adjust |
| [0022](./0022-w6-light-economy-invite.md) | W6 · Light Economy (Slice 2a) | invite code/redeem, conversion listener (payments event) → inviter coin (idempotent, capped), admin invite summary |
| [0023](./0023-w6-admin-content-editor.md) | W6 · Admin Content Editor | knowledge-center article CRUD + publish/unpublish (ADMIN/EDITOR, trust metadata required), role-gated admin menu |
