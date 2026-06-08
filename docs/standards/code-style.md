# Code Style & Naming Standards

> Canonical context: [`../../AGENTS.md`](../../AGENTS.md). This list is **binding** (PR review + lint).
> Automated: Prettier (format) + ESLint (`@mentor/config`). Not a style debate — comply.

## 1. File naming

| Kind | Rule | Example |
|---|---|---|
| NestJS class files | `kebab-case` + **role suffix** | `study-session.controller.ts` · `.service.ts` · `.module.ts` · `.repository.ts` |
| DTO / schema | `kebab-case.dto.ts` | `create-study-session.dto.ts` |
| Port / adapter | `*.port.ts` · `*.adapter.ts` | `job-queue.port.ts` · `iyzico.adapter.ts` |
| Guard / interceptor / event | `*.guard.ts` · `*.event.ts` | `roles.guard.ts` · `post-verified.event.ts` |
| Test | `*.spec.ts` (unit) · `*.e2e-spec.ts` | `economy.service.spec.ts` |
| React **component** | `PascalCase.tsx` (file = component name) | `StudyTimer.tsx` |
| React **hook** | `useXxx.ts` (camelCase) | `useStreak.ts` |
| Other TS (util/const/config) | `kebab-case.ts` | `format-date.ts` · `net-rules.ts` |
| Next.js framework files | framework name (required, lowercase) | `page.tsx` · `layout.tsx` · `route.ts` |
| Drizzle schema part | `kebab-case.ts` (singular context) | `identity.schema.ts` |

## 2. Identifier naming (TypeScript)

| Element | Rule | Example |
|---|---|---|
| Class / Type / Interface / Enum | `PascalCase` (**no** `I` prefix on interfaces) | `StudySession`, `LedgerEntry`, `UserRole` |
| Variable / function / method | `camelCase` | `createSession`, `pendingBalance` |
| Boolean | `is/has/can/should` prefix | `isActive`, `hasPremium`, `canVote` |
| Constant (module-level, immutable config) | `UPPER_SNAKE_CASE` | `NET_PENALTY_DIVISOR`, `MAX_DAILY_COIN` |
| Enum member (matches DB value) | `UPPER_SNAKE_CASE` | `UserRole.ORG_ADMIN`, `LedgerStatus.PENDING` |
| React component | `PascalCase` | `StudyTimer`, `StreakBadge` |
| React props type | `XxxProps` | `StudyTimerProps` |
| Event handler (FE) | `handleXxx` / prop `onXxx` | `handleSubmit`, `onComplete` |
| DI token (Symbol) | `XXX_PORT` | `JOB_QUEUE_PORT` |
| Generic type parameter | single letter `T`/`K`/`V` or `TXxx` | `Paginated<T>` |

- **`any` is banned** → `unknown` + narrow. Name types meaningfully (`user`, `sessionInput`, not `u`/`data`).

## 3. Database (Drizzle / Postgres)

- **Table:** `snake_case` plural → `users`, `study_sessions`, `ledger_entries`, `info_articles`.
- **Column:** `snake_case` → `created_at`, `org_id`. TS field is `camelCase` (Drizzle maps).
- **PK:** `id` (prefer uuid v7). **FK:** `<entity>_id` (`user_id`, `coach_id`).
- **Time:** `created_at`, `updated_at` (timestamptz, UTC). **Boolean:** `is_*`.
- **Enum values:** `UPPER_SNAKE` (1:1 with TS enums): `'PENDING'`, `'STUDENT'`.
- **Money:** **no** float → store `numeric`/integer (minor units); transport as a string in the API (§api.md).

## 4. Domain event & job names

- **Event class:** past tense, `PascalCase` → `PostVerified`, `SubscriptionRenewed`.
- **Event/topic string:** `module.entity.action` (lowercase, dotted) → `forum.post.verified`.
- **Job name (queue):** `module.action` (lowercase, dotted) → `ai.analyze-mock`, `notifications.send-push`.

## 5. Code layout

- **Format:** Prettier defaults (2 spaces, double quotes, semicolons, ~80-100 cols). Don't hand-align; `pnpm format`.
- **Import order:** (1) node/external → (2) `@mentor/*` workspace → (3) relative (`./`, `../`). Blank line between groups.
- **Exports:** **prefer named exports** (refactor + tree-shake). Default export only when a framework requires it
  (Next `page/layout`, none for Nest).
- **Errors:** no silent swallowing; throw a typed exception → map to `ApiError` at the boundary. `catch (e) {}` banned.
- **Async:** no floating promises (`await` or `void`); independent work via `Promise.all`.
- **Functions:** short, single-responsibility, **early return** (instead of deep `if`).
- **Comments:** English, explain the **"why"** (not the "what"); reference the relevant decision `§x`. No dead code.
- **No magic numbers:** BE → config registry/constant; FE → DESIGN token.

## 6. Git

- **Branch:** `feat/<topic>` · `fix/<topic>` · `chore/<topic>`. `main` protected.
- **Commit:** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
