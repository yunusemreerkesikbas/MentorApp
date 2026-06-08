# apps/admin — Mentor Internal Admin Panel (Next.js)

> **Canonical guide: [`../../AGENTS.md`](../../AGENTS.md)** (project-wide rules, guardrails §4, stack).
> Product: [`../../sinav-kocluk-roadmap.md`](../../sinav-kocluk-roadmap.md) §9 (admin, Turkish) · Design: [`../../DESIGN.md`](../../DESIGN.md).

**When working in this app:**
- Team-only access: behind **Cloudflare Access**, invite-based accounts, no self-signup (§9).
- UI values come from **DESIGN.md tokens** (`@mentor/ui`) — no magic numbers.
- All React/Next.js code follows the **`vercel-react-best-practices`** skill.
- Data from the **single API**: `@mentor/api-client` (NestJS `/v1`). **Audit log from day one** — every admin action is logged (§9).
- Sensitive operations (money/coin/commission) → bounds + audit; don't break the economy with bad input.

The block below is managed by the Next.js toolchain (don't edit by hand):

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
