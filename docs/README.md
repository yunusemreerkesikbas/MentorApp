# Mentor Documentation Index

> **Canonical agent & engineering guide:** [`AGENTS.md`](../AGENTS.md)
> **Product decision record:** [`sinav-kocluk-roadmap.md`](../sinav-kocluk-roadmap.md) · **Quick product summary:** [`PRODUCT.md`](../PRODUCT.md)
> **Design system:** [`DESIGN.md`](../DESIGN.md) · **Voice & Copy constitution:** [`docs/copy/voice.md`](./copy/voice.md)

---

## 1. Core Architecture & Operations (`docs/core/`)

Index: [`docs/core/README.md`](./core/README.md)

| Document | Scope |
|---|---|
| [`architecture.md`](./core/architecture.md) | Modular monolith, bounded contexts, event bus, RLS, ports & adapters |
| [`base-infrastructure.md`](./core/base-infrastructure.md) | NestJS bootstrap, `pg` Pool, RLS helpers, `ConfigService`, `JobQueuePort`, OpenAPI |
| [`conventions.md`](./core/conventions.md) | Language, branching, commits, modularity, feature-doc rule, ticket registry |
| [`design-system.md`](./core/design-system.md) | `@mentor/ui` primitives, tokens, and styling bridge to `DESIGN.md` |
| [`file-structure.md`](./core/file-structure.md) | Monorepo layout (`apps/*`, `packages/*`, module anatomy) |
| [`setup.md`](./core/setup.md) | Local development setup, Docker Postgres, `.env`, seed & test commands |
| [`deployment.md`](./core/deployment.md) | Render blueprint, cron jobs, zero-cost/closed-trial provider modes, migrations |
| [`storage-r2.md`](./core/storage-r2.md) | Cloudflare R2 presigned uploads, quotas, and cleanup lifecycle |
| [`integrations.md`](./core/integrations.md) | External provider setup (OpenAI, Gemini, Resend, Netgsm, iyzico, Cloudflare, Google OAuth) |
| [`security-release-checklist.md`](./core/security-release-checklist.md) | Pre-launch security, RLS, KVKK, and edge hardening checklist |
| [`deferred-staging.md`](./core/deferred-staging.md) | Items awaiting external production credentials or legal sign-off |
| [`workstreams.md`](./core/workstreams.md) | Module ownership tracks (`W1–W8`) and shared-file touch rules |
| [`mvp-status.md`](./core/mvp-status.md) | Capability status across all modules (`W1–W8` + cross-cutting) |

---

## 2. Binding Engineering Standards (`docs/standards/`)

| Document | Scope |
|---|---|
| [`engineering-principles.md`](./standards/engineering-principles.md) | SOLID/DRY/KISS/YAGNI, <250–300 line modularity, backend-only logic, localized errors, DoD |
| [`code-style.md`](./standards/code-style.md) | Naming conventions (files, symbols, DB, events), TypeScript rules, imports, Git |
| [`api.md`](./standards/api.md) | `/v1` REST envelope, error codes, pagination, rate limits, and complete Service Catalog |
| [`backend.md`](./standards/backend.md) | NestJS module structure, Drizzle + RLS (`withUserContext`), zero-downtime migrations, testing |
| [`frontend.md`](./standards/frontend.md) | Next.js 16 + React 19, `next-intl` TR/EN, `DESIGN.md` tokens, skeletons, performance |
| [`mobile.md`](./standards/mobile.md) | Phase 2 Expo / React Native rules (single `/v1` API, shared packages) |
| [`code-review.md`](./standards/code-review.md) | PR review checklist, guardrails §4 verification, security & quality bar |

---

## 3. Feature Documentation (`docs/features/`)

Index: [`docs/features/README.md`](./features/README.md). Every meaningful code change appends a concise milestone entry to its feature doc.

| Feature Doc | Module / Scope |
|---|---|
| [`identity.md`](./features/identity.md) | Auth, JWT rotation, Google OAuth, SMS OTP, profile, KVKK, invite-only waitlist (`W1`) |
| [`coaching.md`](./features/coaching.md) | Onboarding, weekly plan (`Puhu’yla planla`), `/seans` focus timer, rooms, notebooks, mocks, analytics (`W2`) |
| [`ai.md`](./features/ai.md) | Puhu AI chat, greeting, reflections, weekly deep analysis, vision, RAG, budget & kill-switches (`W3`) |
| [`payments.md`](./features/payments.md) | Subscriptions, entitlement, carded trials, `PremiumPaywallModal`, purchase channels (`W4`) |
| [`promotions.md`](./features/promotions.md) | Coupon & automatic discount engine (`ANYONE`, `NEW_USER`, `ACTIVE_DAYS`, `WIN_BACK`, `INVITED`) |
| [`ads.md`](./features/ads.md) | Google AdSense placements & rewarded video ads (`ads` module) |
| [`content.md`](./features/content.md) | Exam catalog (`KPSS · YKS · LGS · ALES · DGS`), taxonomy, verified dates, `/bilgi` blog (`W5a`) |
| [`notifications.md`](./features/notifications.md) | In-app notification center (SSE), email (`Resend`), announcements, dunning/win-back (`W5b`) |
| [`admin.md`](./features/admin.md) | Back-office console (`apps/admin`): users, metrics, content, config, moderation, promotions, waitlist (`W6`) |
| [`economy.md`](./features/economy.md) | Append-only `XP`/`Coin` ledger, quests, 12-level Night Journey, Weekly Chest, friend invites (`W7a`) |
| [`forum.md`](./features/forum.md) | Exam-scoped Q&A forum, reactions, tags, moderation, verified answers (`W7b`) |
| [`community.md`](./features/community.md) | Shared study rooms (`LIBRARY`/`CAFE`/`HOME`), weekly XP leagues (`Lig`), Weekly Recap stories (`W7c`) |
| [`mentorship.md`](./features/mentorship.md) | Human coach workspace (`/kocum`, `/koclar`), student links, tasks, sponsored seats, coach AI (`W8`) |
| [`web-shell.md`](./features/web-shell.md) | Public landing (`/` "Işıklı şehir"), `AppNav`, layout, Puhu hero mask, cross-cutting B2C shell |
| [`i18n.md`](./features/i18n.md) | TR/EN URL routing (`next-intl`), localized backend messages & AI language routing |
| [`motion.md`](./features/motion.md) | Motion architecture, Lottie/WebP/MP4 pipelines, `HungBoard`, ceremony choreography |
| [`preference-simulation.md`](./features/preference-simulation.md) | YKS 3D Campus + Preference Simulation prototype (feature-flagged off) |
| [`room-theme-visual-prompts.md`](./features/room-theme-visual-prompts.md) | Art generation prompts and asset specs for top-down study rooms (`LIBRARY`/`CAFE`/`HOME`) |

---

## 4. Other Directories

- [`docs/copy/voice.md`](./copy/voice.md) — Canonical dual-register Voice & Copy Constitution (**Puhu** & **Companion**).
- [`docs/editorial/`](./editorial/) — Verified Turkish editorial articles and exam guides.
- [`docs/plans/`](./plans/) & [`docs/qa/`](./qa/) — Historical architectural plans and QA verification reports.
