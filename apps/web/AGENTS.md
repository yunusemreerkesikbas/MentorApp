# apps/web — Mentor B2C (Next.js)

> **Canonical guide: [`../../AGENTS.md`](../../AGENTS.md)** (project-wide rules, guardrails §4, stack).
> Product: [`../../sinav-kocluk-roadmap.md`](../../sinav-kocluk-roadmap.md) (Turkish) · Design: [`../../DESIGN.md`](../../DESIGN.md).

**When working in this app:**
- UI values come from **DESIGN.md tokens** (`@mentor/ui` / CSS variables) — no magic numbers.
- **Loading UI:** until data fetch resolves, show a **page-specific** `*-content-skeleton.tsx` layout;
  shimmer/enter animation uses **global** classes only (`.mentor-skeleton-shimmer`, `.mentor-skeleton-enter`
  via `@mentor/ui` `Skeleton` / `SkeletonGroup`) — see [`docs/standards/frontend.md`](../../docs/standards/frontend.md) § Loading skeletons.
- All React/Next.js code follows the **`vercel-react-best-practices`** skill (priority: async-waterfall → bundle → server).
- **Component modularity & size discipline:** Components must NOT swell into giant files (500+ lines). Proactively break components into subcomponents *during development* when approaching ~250–300 lines or accumulating multiple concerns (view phases, toolbars, setup cards, param parsers). Shells orchestrate; subcomponents render (see [`docs/standards/frontend.md`](../../docs/standards/frontend.md)).
- Data comes from the **single API**: `@mentor/api-client` (NestJS `/v1`). Don't build a separate backend/route logic.
- Server component by default; client only when needed. Turkish tone (§0), accessibility.
- **Unit tests:** `pnpm --filter @mentor/web test` (Vitest, `src/**/*.spec.ts`, Node env — pure logic
  only; anything needing a DOM belongs in `test:e2e`). CI runs it through `turbo run test`.
- **`tsconfig.json` is rewritten by `next build`** — it drops JSONC comments and any key it does not
  recognise, so never document anything inside that file. Two entries there are load-bearing and
  must not be removed:
  - `paths.react` / `paths.react-dom` pin React's types for the whole program, `node_modules`
    `.d.ts` files included. `apps/admin` is React 18 (accepted deviation), so pnpm hoists
    `@types/react@18` into `.pnpm/node_modules`, and any package that does not declare its own
    `@types/react` — framer-motion is the one that bites — resolves 18's types while our code is on
    19. The two `ReactNode` unions are not mutually assignable, so passing a `ReactNode` variable as
    `children` to `motion.div` fails to compile. `pnpm.overrides` cannot fix it: framer-motion
    declares no `@types/react` edge, and forcing 19 workspace-wide would break admin.
  - After changing anything in `tsconfig.json`, run `pnpm --filter @mentor/web build` and re-read
    the file to confirm the toolchain kept your change.

The block below is managed by the Next.js toolchain (don't edit by hand):

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
