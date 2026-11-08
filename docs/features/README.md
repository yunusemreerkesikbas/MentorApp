# Feature Documentation (`docs/features/`)

Living documentation for every bounded context and cross-cutting user-facing capability.

## Mandatory Feature-Doc Rule (`AGENTS.md` §10)

Every meaningful feature, architectural change, or user-visible refinement must update its matching document in this folder (under `## Geliştirmeler (timeline)` or by updating the canonical architecture/rules section when a rule changes):
- **What changed** (concise decision summary)
- **Usage** (flags, endpoints, commands, or component props)
- **Gotchas** (non-obvious invariants or edge cases)
- **Related files**

---

## Feature Index

| File | Workstream / Module | Scope |
|---|---|---|
| [`ci.md`](./ci.md) | Cross-cutting · engineering | Scoped PR checks, sensitive-change validation, full release CI and usage |
| [`identity.md`](./identity.md) | `W1` · `modules/identity` | Auth, JWT refresh rotation, Google OAuth, SMS OTP, profile, KVKK, invite-only waitlist |
| [`coaching.md`](./coaching.md) | `W2` · `modules/coaching` | Onboarding, weekly plan (`Puhu’yla planla`), `/seans` focus timer, study notebooks, mocks, analytics |
| [`ai.md`](./ai.md) | `W3` · `modules/ai` | Puhu AI chat, daily greeting, mood/session reflections, weekly deep analysis, vision, RAG, budget |
| [`payments.md`](./payments.md) | `W4` · `modules/payments` | Subscriptions, entitlement, carded trials, `PremiumPaywallModal`, purchase channels |
| [`promotions.md`](./promotions.md) | `W4+` · `modules/promotions` | Coupon & automatic discount engine (`ANYONE`, `NEW_USER`, `ACTIVE_DAYS`, `WIN_BACK`, `INVITED`) |
| [`ads.md`](./ads.md) | `W4+` · `modules/ads` | Google AdSense placements & rewarded video ads |
| [`content.md`](./content.md) | `W5a` · `modules/content` | Exam catalog (`KPSS · YKS · LGS · ALES · DGS`), taxonomy, verified dates, `/bilgi` blog |
| [`notifications.md`](./notifications.md) | `W5b` · `modules/notifications` | In-app SSE notifications, `Resend` transactional emails, announcements, win-back |
| [`admin.md`](./admin.md) | `W6` · `modules/admin` + `apps/admin` | Back-office console: users, metrics, content, config, moderation, promotions, waitlist |
| [`economy.md`](./economy.md) | `W7a` · `modules/economy` | Append-only `XP`/`Coin` ledger, quests, 12-level Night Journey, Weekly Chest, friend invites |
| [`forum.md`](./forum.md) | `W7b` · `modules/forum` | Exam-scoped Q&A forum, reactions, tags, moderation, verified answers |
| [`community.md`](./community.md) | `W7c` · `modules/community` | Shared study rooms (`LIBRARY`/`CAFE`/`HOME`), weekly XP leagues (`Lig`), Weekly Recap |
| [`mentorship.md`](./mentorship.md) | `W8` · `modules/mentorship` | Human coach workspace (`/kocum`, `/koclar`), student links, tasks, sponsored seats, coach AI |
| [`web-shell.md`](./web-shell.md) | Cross-cutting · `apps/web` | Landing (`/` "Işıklı şehir"), `AppNav`, layout, Puhu hero mask, shared B2C shell |
| [`i18n.md`](./i18n.md) | Cross-cutting · `apps/web` + `apps/api` | TR/EN URL routing (`next-intl`), localized backend messages & AI language routing |
| [`motion.md`](./motion.md) | Cross-cutting · `apps/web` | Motion tokens, Lottie/WebP/MP4 assets, `HungBoard`, ceremony choreography |
| [`preference-simulation.md`](./preference-simulation.md) | `W2/W5` · Prototype | YKS 3D Campus + Preference Simulation (disabled via `coaching.preference_simulation.enabled`) |
| [`room-theme-visual-prompts.md`](./room-theme-visual-prompts.md) | Asset guide | Generation prompts and composition rules for top-down study room art |
