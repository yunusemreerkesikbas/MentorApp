# apps/admin — Mentor Internal Admin Panel (Duralux / Bootstrap)

> **Canonical guide: [`../../AGENTS.md`](../../AGENTS.md)** (project-wide rules, guardrails §4, stack).
> Product: [`../../sinav-kocluk-roadmap.md`](../../sinav-kocluk-roadmap.md) §9 (admin, Turkish).

## What this app is
The W6 admin panel is the **Duralux CRM admin template**, adopted **as-is** (product decision —
devnote 0018). It is **deliberately different** from the rest of the monorepo:

| Aspect | This app (admin) | Rest of monorepo (web/api) |
|---|---|---|
| Framework | **Next.js 14** (App Router) | Next.js 16 / NestJS, TypeScript |
| Styling | **Bootstrap 5 + SCSS** (`src/assets/scss`) | Tailwind v4 + `@mentor/ui` tokens |
| Language | **Hybrid**: our code is `.ts/.tsx`, the Duralux template stays `.js/.jsx` | TypeScript |
| Deps install | pnpm workspace (no `package-lock.json`) | pnpm workspace |
| Data | plain `axios` (`src/lib/apiClient.ts`), not `@mentor/api-client` | typed `@mentor/api-client` |

This is an accepted deviation from the usual "DESIGN.md tokens + api-client" rule because the
admin is an **internal team-only tool** and reusing a ready Bootstrap template was chosen for speed.
Keep the **styling** as Bootstrap/SCSS — don't convert it to Tailwind/`@mentor/ui` piecemeal.
Dependencies are pnpm-managed (normal workspace member) — don't reintroduce npm here.

**TypeScript (hybrid):** code WE write goes in `.ts/.tsx` with `strict` on; the Duralux template
files stay `.js/.jsx` (untyped, `checkJs:false` → imported as `any`). Shared identity types come
from `@mentor/types` (e.g. `AuthUser`, `UserRole`); admin-specific API shapes live in
`src/lib/types.ts`. **Don't** mass-convert the template to TS.
- `pnpm typecheck` uses `tsconfig.typecheck.json` (scoped to `.ts/.tsx` only) → enforces types on
  our code. `next build` sets `typescript.ignoreBuildErrors: true` because the off-menu Duralux demo
  pages don't satisfy Next's generated route types; our safety net is `pnpm typecheck`, not the build.

## Working rules
- **Team-only access:** behind **Cloudflare Access**, invite-based accounts, no self-signup (§9).
- **Single API:** all data comes from NestJS `/v1` via `src/lib/apiClient.ts` (axios). Base URL =
  `NEXT_PUBLIC_API_URL` (already includes `/v1`). Auth token in `src/lib/auth.ts`; session +
  route guard in `contentApi/authProvider.tsx` (wrapped by `components/shared/AdminShell.tsx`).
- **Audit from day one:** every admin mutation is audited **server-side** (the API's
  `AdminAuditInterceptor`) — don't add a client-only "audit". Sensitive ops (money/coin/roles) →
  bounds + audit; don't break the economy with bad input.
- **Menu:** `src/utils/fackData/menuList.ts` is trimmed to the admin surface. The original Duralux
  CRM/applications demo pages still exist as **UX reference** but are off-menu — reuse their
  components/markup when building real admin screens.
- **New screens** live under `src/app/(general)/<feature>/` (sidebar shell). Public/auth screens
  (e.g. `/login`) live outside the `(general)` group.

## Commands
```bash
pnpm dev                            # turbo: all apps (api :3001 · web :3000 · admin :3002)
pnpm --filter @mentor/admin dev     # admin only — next dev on :3002 (needs the api on :3001)
pnpm --filter @mentor/admin build
pnpm --filter @mentor/admin typecheck   # tsc on our .ts/.tsx (tsconfig.typecheck.json)
pnpm --filter @mentor/admin add <pkg>   # add a dependency (pnpm-managed, like every workspace app)
```
> Build scripts (e.g. `core-js`) are gated by pnpm; decisions live in `pnpm-workspace.yaml`
> (`allowBuilds`). A new dep with an unapproved postinstall → add an entry there (true/false).
