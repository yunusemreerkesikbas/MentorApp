# apps/admin — Agent Guide (Admin Panel)

> Inherits root [`AGENTS.md`](../../AGENTS.md). Read this before touching `apps/admin`.
> Feature doc: [`docs/features/admin.md`](../../docs/features/admin.md).

## Context: Duralux template adaptation

`apps/admin` is an **internal back-office console** (RBAC-gated behind Cloudflare Access + `STAFF`
JWT roles: `SUPER_ADMIN | CONTENT_EDITOR | MODERATOR | FINANCE | SUPPORT`). To ship MVP admin fast,
it was built by adapting the **Duralux** admin template rather than from scratch on `@mentor/ui`.

Because of that origin, `apps/admin` has **intentional, accepted deviations** from
[`docs/standards/frontend.md`](../../docs/standards/frontend.md) (which governs the B2C `apps/web` app).
**Do not "fix" these deviations into Tailwind/`@mentor/ui` rewrites** unless explicitly tasked.

## Actual stack in `apps/admin`

| Area | `apps/web` (standard) | `apps/admin` (Duralux — accepted) |
|---|---|---|
| Framework | Next.js 16 · React 19 (App Router) | **Next.js 16 · React 19** (App Router, upgraded in APP-084) |
| Styling | Tailwind v4 + `@mentor/ui` tokens (`DESIGN.md`) | **Bootstrap 5 + SCSS** (`src/assets/scss`) + Feather/React-Icons |
| Language | Strict `.ts/.tsx` | **Hybrid:** Mentor pages/lib in `.ts/.tsx`; template shell/vendors in `.js/.jsx` (`allowJs: true`) |
| `next.config` | Strict build | `typescript.ignoreBuildErrors: true` (template JSX compat — still run `typecheck` on `.ts/.tsx` you touch) |
| API access | `@mentor/api-client` | `src/lib/admin-api.ts` (`axios` wrapper with Bearer token + 401 refresh + `{ data, meta }` unwrap) |
| Tables/forms | `@mentor/ui` primitives | Shared `src/components/shared/admin/{DataTable,FilterBar,StatusBadge,ConfirmModal,FormSection}.tsx` |

## Rules when working in `apps/admin`

1. **New Mentor admin pages (`src/app/(general)/*` and `src/lib/*`) MUST be written in TypeScript (`.ts/.tsx`)** with proper types from `@mentor/types` and schemas from `@mentor/validation`.
2. **Use the existing admin primitives:** `adminApi` (`src/lib/admin-api.ts`), `useAdminAuth` (`src/context/AdminAuthContext.tsx`), and `src/components/shared/admin/*` (`DataTable`, `FilterBar`, `StatusBadge`, `ConfirmModal`, `FormSection`).
3. **Match Duralux visual conventions** inside admin (Bootstrap `card`, `table`, `badge`, `btn`, `form-control`, `form-select`) — **do NOT apply `DESIGN.md` B2C tokens here.** `DESIGN.md` is for `apps/web` and mobile.
4. **Never touch `src/components/*` template vendor code** unless removing dead demo routes or fixing a concrete bug.
5. **Security & RBAC still 100% apply:** backend guards (`@Roles(...)` + `StaffGuard`) are authoritative; frontend role checks (`hasRole`) are UX-only. Every mutating admin action is audit-logged on the backend.
6. **Backend-localized errors:** display `getApiErrorMessage(err)` — never hardcode error interpretations.
