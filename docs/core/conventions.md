# Conventions

> Naming, code style, and per-stack rules live in [standards/](../standards/) (canonical). This file holds
> only the cross-cutting basics not repeated there.

## Language
- Code / identifiers / file names: **English**. Comments / engineering docs: **English**. User-facing text: **Turkish** (§0 tone).
- Intentionally Turkish: `README.md` (product overview) + `sinav-kocluk-roadmap.md` (product decisions).

## Config & secrets
- Tunables (coin/XP caps, rate-limit, price, thresholds) → central **config registry** (typed + Zod, §9);
  no magic numbers. Sensitive (money) → bounds + audit.
- Secrets in `.env` (git-ignored). Template `.env.example`. Steps in `docs/integrations.md`.

## Git
- **Conventional Commits** (`feat/fix/chore/docs/refactor/test`). `master` protected; PR → squash.
- **Branch format:** `feature/APP-NNN-<short-slug>` (NNN = sequential ticket no; registry below).
  One branch per workstream track — parallel agents must NOT share a branch (see workstreams.md).
  Fixes: `fix/APP-NNN-<slug>`.
- Commit/PR only when the user asks; `.env` is never committed.

### Ticket registry (APP-NNN)
| No | Scope |
|---|---|
| APP-001 | Integration: design infra + W1/W2 slices + W4 payments (single PR — pre-branch-discipline batch) |
| APP-002 | Admin foundation (STAFF + audit log + user management + UI shell) |
| APP-003 | Config registry + feature flags (typed catalog + DB overrides + admin editor) |
| APP-004 | Economy substrate: XP/Coin ledger + invite → conversion → coin |
| APP-005 | Admin content/exam editors + refund/subscription view + metrics dashboard |
| APP-006 | Economy quests + fine admin sub-roles (SUPPORT/FINANCE/MODERATOR/SUPER_ADMIN) |
| APP-007 | W3 AI coach chat + RAG grounding + coin→AI spend + web koç/profil UI |
| APP-008 | B2C web UI polish sweep (landing, auth, panel, plan, seans, analiz, bilgi, abonelik, app shell) |
| APP-009 | W3 photo→subject categorize (VisionPort + StoragePort) |
| APP-010 | W2/W3 mood AI-adaptive + ghost (geçmiş-ben) comparison + code review fixes |
| APP-011 | Web i18n: next-intl TR/EN (URL-based, 14 namespaces, ~290 keys, static render) |
| APP-012 | Forum slice 6: SEO (public QA pages, JSON-LD, sitemap, XSS fix) + mvp-status update |
| APP-013 | Docs refactor: devnotes → features/ + core/ consolidation |
> Next number = last row + 1. Add a row when opening a branch.

## Standards (binding)
Engineering principles · code-style (naming) · api · backend · frontend · mobile · code-review →
[standards/](../standards/code-review.md). Full index: [docs/README.md](../README.md).

## Feature-doc (mandatory)
After every meaningful development, add a short note to the relevant
[features/<bucket>.md](../features/README.md). No doc update → no merge.
See [AGENTS.md §10](../../AGENTS.md) for the full rule.

## Testing (later)
Unit: domain/use-case. Integration: repository + adapter. E2E: critical flows (auth, payment webhook
idempotency). The skeleton has no suite yet — update here once added.

## Quality gates (CI)
`pnpm lint` · `pnpm typecheck` · `pnpm build` must be green to merge (`.github/workflows/ci.yml`).
