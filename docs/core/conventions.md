# Conventions, Branching & Ticket Registry

> Single source of repository conventions, naming, commit discipline, and ticket history.
> Detailed style rules: [`docs/standards/code-style.md`](../standards/code-style.md).
> Engineering principles: [`docs/standards/engineering-principles.md`](../standards/engineering-principles.md).

---

## 1. Language & Copy Discipline

- **Code, identifiers, DB columns, routes (internal), comments, and engineering docs:** **English**.
  - *Intentional Turkish exceptions:* `README.md`, `sinav-kocluk-roadmap.md`, Turkish copy examples in [`docs/copy/voice.md`](../copy/voice.md), and Turkish editorial content in [`docs/editorial/`](../editorial/).
- **User-facing product copy:** **Turkish** (`tr`, default) and **English** (`en`), governed by [`docs/copy/voice.md`](../copy/voice.md).
  - **Dual register:** **Puhu** (energetic, Duolingo-like cheering voice for chrome, landing, quests, community, leagues, levels, achievements, invites, unlocks, waitlist) + **Companion** (calm, steady voice for AI coach chat, low mood, broken streak, errors, payments, official facts).
  - **AI vs. Human Coach naming:** The AI coach is named **Puhu** (`yapay zekâ`, never `AI` in Turkish); plain **"koç"** means the human coach (`mentorship`).
  - **i18n:** All `apps/web` strings live in `apps/web/messages/{tr,en}.json` with mirrored keys; backend errors/notifications localize via `Accept-Language` (`tr` | `en`).

---

## 2. Shared Packages & Contracts

| Package | Responsibility | Rule |
|---|---|---|
| `@mentor/types` | Shared DTOs, enums, API contracts, domain event payloads | Single source of truth for types; avoid `any`. |
| `@mentor/validation` | Zod schemas shared across `apps/api`, `apps/web`, `apps/admin` | Validate at API boundaries and forms using the same schema. |
| `@mentor/core` | Pure exam-agnostic domain calculators (net score, streak math, countdowns) | Zero framework or I/O dependencies. |
| `@mentor/api-client` | Typed HTTP client for `/v1` endpoints with token refresh & locale header | Used by `apps/web` (and Phase 2 mobile). |
| `@mentor/ui` | Design tokens (`theme.css`) and shared React primitives (`Button`, `Card`, `Chip`, `Field`, `Logo`, etc.) | Follows [`DESIGN.md`](../../DESIGN.md); no magic numbers. |
| `@mentor/config` | Shared TS, ESLint, and Prettier configurations | Inherited by all apps and packages. |

---

## 3. Git, Branches & Commits

- **Protected main:** `main` is protected; all work lands via feature branches (`feat/<topic>` or `feature/APP-XXX`).
- **Conventional Commits:**
  - `feat(<scope>): ...` — new capability
  - `fix(<scope>): ...` — bug fix
  - `refactor(<scope>): ...` — structural improvement without behavior change
  - `docs(<scope>): ...` — documentation & feature-doc timeline updates
  - `test(<scope>): ...` — unit / integration / e2e tests
  - `chore(<scope>): ...` — build, deps, config
- **Iterative verification scope (binding):**
  - During development, run the **smallest relevant test suite and targeted typecheck/lint** for the touched package/files.
  - Run full workspace `pnpm build | lint | typecheck | test` only when touching cross-cutting contracts (`@mentor/types`, `@mentor/validation`, auth, payments, migrations) or before declaring a branch merge/release-ready.

---

## 4. Modularity & File Size Target

- Keep files focused and under **~250–300 lines** (FE components and BE services alike).
- Decompose **proactively during development**:
  - **Frontend:** Extract subcomponents, view stages, custom hooks, and pure helper modules.
  - **Backend:** Keep controllers thin (HTTP routing + guards + DTO mapping); split complex application services into focused sub-services, pure domain calculators (`domain/`), and repository query helpers (`infrastructure/`).

---

## 5. Feature Documentation Rule (Mandatory)

Every meaningful change must update the corresponding feature doc under [`docs/features/`](../features/README.md) with a concise entry covering:
1. **What changed** (architectural or product decision).
2. **Usage** (flags, commands, or component APIs).
3. **Gotchas** (non-obvious invariants or edge cases).
4. **Related files**.

---

## 6. Milestone & Ticket Registry (`0001–0042` & `APP-001–APP-138`)

- **Foundation & MVP Sprints (`0001–0042`):** Monorepo bootstrap (`0001`), Drizzle + RLS (`0002–0005`), W1 Identity (`0006–0008`), W2 Coaching (`0009–0011`), W3 AI (`0012–0014`), W4 Payments (`0015`), W5 Content & Notifications (`0016–0020`), W6 Admin (`0021–0026`), B2C Web Polish & i18n TR/EN (`0027–0042`).
- **Phase 2 & Launch Tracks (`APP-001–APP-138`):**
  - `APP-001–APP-035`: Economy (`XP`/`Coin` append-only ledger, quests, levels, friend invite rewards & refund clawback), Forum (exam-scoped Q&A, coach/editorial verification), Community (study rooms `LIBRARY`/`CAFE`/`HOME`, XP leagues, Weekly Recap stories).
  - `APP-036–APP-069`: Study notebooks (photo-logged pages, shelf & review fan), Vision Board & YKS preference simulation prototype, AdSense & rewarded ads (`ads` module), Promotions & coupon engine (`promotions` module).
  - `APP-070–APP-099`: W8 Mentorship (human coach link `/kocum`, coach directory `/koclar`, coach workspace, sponsored seats & billing channel flags, coach AI briefs & homework drafts).
  - `APP-100–APP-129`: SMS OTP & phone-bound trial/invite security, closed-trial operator runbooks, AI provider kill-switches, bounded trial R2 storage.
  - `APP-130–APP-138`: Landing "Işıklı şehir" + Sabah Masası + Odak Odası + Gece Yolculuğu + Premium flight sheet, "Puhu’yla planla" night stage, Weekly Chest opening desk, Puhu hero domino mask (`PremiumIdentityMark`), 5 exam families (`KPSS · YKS · LGS · ALES · DGS`), AI coach named **Puhu**, energetic Duolingo-like Puhu voice standard, and invite-only waitlist gate (`/bekleme-listesi`).
