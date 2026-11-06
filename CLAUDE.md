# CLAUDE.md

> **Canonical agent & engineering guide:** [`AGENTS.md`](./AGENTS.md) — read it first.
> **Product source of truth:** [`sinav-kocluk-roadmap.md`](./sinav-kocluk-roadmap.md).
> **Design system:** [`DESIGN.md`](./DESIGN.md).
> **Voice & Copy constitution:** [`docs/copy/voice.md`](./docs/copy/voice.md).

All rules, architecture decisions, module boundaries, guardrails, and conventions live in
**`AGENTS.md`**. Keep a single source of truth — do not duplicate or diverge here.

Quick pointers:
- **Stack:** TypeScript monorepo (Turborepo + pnpm) · NestJS `/v1` · Next.js 16 + React 19 (web + admin) · Expo (Phase 2) · Drizzle + Neon Postgres (pg Pool + RLS) · Cloudflare + Render · OpenAI + Gemini Flash · Resend (email) · iyzico (payments).
- **Supported exams:** `KPSS · YKS · LGS · ALES · DGS` (exam-agnostic engine; differ only by taxonomy/net rule/calendar config).
- **Voice:** Dual register per [`docs/copy/voice.md`](./docs/copy/voice.md) — **Puhu** is energetic & Duolingo-like (chrome, landing, quests, community, leagues, levels, invites, unlocks); **Companion** is calm & steady (AI coach chat, low mood, errors, payments, official facts). AI coach is named **Puhu** (`yapay zekâ`, never `AI` in TR); plain `koç` = human coach.
- **Standards (binding):** [`docs/standards/`](./docs/standards/) — [`engineering-principles.md`](./docs/standards/engineering-principles.md), [`code-style.md`](./docs/standards/code-style.md), [`api.md`](./docs/standards/api.md), [`backend.md`](./docs/standards/backend.md), [`frontend.md`](./docs/standards/frontend.md), [`mobile.md`](./docs/standards/mobile.md), [`code-review.md`](./docs/standards/code-review.md).
- **Docs index:** [`docs/README.md`](./docs/README.md).
