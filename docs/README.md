# docs — Mentor Documentation Index

> Canonical guide: [`../AGENTS.md`](../AGENTS.md) · Product decisions: [`../sinav-kocluk-roadmap.md`](../sinav-kocluk-roadmap.md) (Turkish) · Design: [`../DESIGN.md`](../DESIGN.md).

## Platform docs — [`core/`](./core/README.md)
- [core/architecture.md](./core/architecture.md) — module map, event backbone, AI architecture
- [core/workstreams.md](./core/workstreams.md) — **parallel MVP tracks**: ownership boundaries + shared-file rules
- [core/file-structure.md](./core/file-structure.md) — folder structure + package dependency direction
- [core/mvp-status.md](./core/mvp-status.md) — one-page MVP snapshot (what's built vs pending)
- [core/setup.md](./core/setup.md) — local setup + troubleshooting
- [core/integrations.md](./core/integrations.md) — connecting Neon/iyzico/Cloudflare/OpenAI/Gemini/Postmark/Sentry
- [core/conventions.md](./core/conventions.md) — code/commit/PR/language/config conventions + ticket registry
- [core/base-infrastructure.md](./core/base-infrastructure.md) — DB, errors, i18n, logging, health, OpenAPI, tests
- [core/repo-and-conventions.md](./core/repo-and-conventions.md) — repo hygiene, standards, git, agent-skills
- [core/design-system.md](./core/design-system.md) — `@mentor/ui` design system, fonts, responsive shell

## Copy — [`copy/`](./copy/voice.md)
- [copy/voice.md](./copy/voice.md) — dual register (Puhu / companion), *sen* rule, banned patterns, before/after

## Feature docs — [`features/`](./features/README.md)
- [features/identity.md](./features/identity.md) — auth, RLS, JWT, web auth screens (W0)
- [features/content.md](./features/content.md) — exam calendar, knowledge center, pgvector embeddings (W1)
- [features/coaching.md](./features/coaching.md) — daily loop, panel, plan, seans, mock-exam, streak, mood, ghost, vision (W2)
- [features/ai.md](./features/ai.md) — AI coach chat, RAG, photo→subject, mood/ghost/vision AI notes (W3)
- [features/payments.md](./features/payments.md) — subscriptions, entitlement, webhook state machine (W4)
- [features/notifications.md](./features/notifications.md) — job queue, email, web push, config registry + feature flags (W5)
- [features/admin.md](./features/admin.md) — user management, content editors, refunds, metrics, fine RBAC, audit log (W6)
- [features/economy.md](./features/economy.md) — XP/coin ledger, capped rewards, quests, invite, spend (W6)
- [features/ads.md](./features/ads.md) — limited contextual ads + voluntary rewarded Coin (web v1)
- [features/forum.md](./features/forum.md) — zones, feed, Q&A, moderation, SEO (W7)
- [features/web-shell.md](./features/web-shell.md) — landing, app nav, layout, shared motion, B2C UI polish
- [features/i18n.md](./features/i18n.md) — next-intl TR/EN URL-based internationalization
- [features/preference-simulation.md](./features/preference-simulation.md) — YKS 3D campus tour + official historical rank comparison

## Standards (binding — checked in PR review)
- [standards/engineering-principles.md](./standards/engineering-principles.md) — SOLID/DRY/KISS/YAGNI, fallbacks, logic-backend-only, localized messages, Definition of Done
- [standards/code-style.md](./standards/code-style.md) — naming (file/class/variable/DB/event) + code style + git
- [standards/api.md](./standards/api.md) — API design/versioning + **service catalog**
- [standards/backend.md](./standards/backend.md) — NestJS · Drizzle · Neon
- [standards/frontend.md](./standards/frontend.md) — Next.js · React · Tailwind (+ vercel-react-best-practices)
- [standards/mobile.md](./standards/mobile.md) — Expo / RN (Phase 2)
- [standards/code-review.md](./standards/code-review.md) — review checklist + blocking findings

## Plans (historical design documents)
- [plans/](./plans/) — per-track design plans and architectural decisions
