# apps/web — Mentor B2C (Next.js)

> **Canonical guide: [`../../AGENTS.md`](../../AGENTS.md)** (project-wide rules, guardrails §4, stack).
> Product: [`../../sinav-kocluk-roadmap.md`](../../sinav-kocluk-roadmap.md) (Turkish) · Design: [`../../DESIGN.md`](../../DESIGN.md).

**When working in this app:**
- UI values come from **DESIGN.md tokens** (`@mentor/ui` / CSS variables) — no magic numbers.
- **Loading UI:** until data fetch resolves, show a **page-specific** `*-content-skeleton.tsx` layout;
  shimmer/enter animation uses **global** classes only (`.mentor-skeleton-shimmer`, `.mentor-skeleton-enter`
  via `@mentor/ui` `Skeleton` / `SkeletonGroup`) — see [`docs/standards/frontend.md`](../../docs/standards/frontend.md) § Loading skeletons.
- All React/Next.js code follows the **`vercel-react-best-practices`** skill (priority: async-waterfall → bundle → server).
- Data comes from the **single API**: `@mentor/api-client` (NestJS `/v1`). Don't build a separate backend/route logic.
- Server component by default; client only when needed. Turkish tone (§0), accessibility.

The block below is managed by the Next.js toolchain (don't edit by hand):

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
