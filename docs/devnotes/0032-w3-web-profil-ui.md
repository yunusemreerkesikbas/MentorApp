# 0032 — W3 · Web Profil UI (`apps/web` /profil)

> Date: 2026-06-16 · Scope: web (apps/web) + `@mentor/ui` token · Related: DESIGN.md, AGENTS §4 #1,
> unlocks panel countdown / bilgi / analiz via `examType`. Frontend-only; API already shipped.

## What was done
- **`/profil`** rebuilt as a functional account hub: `ProfilShell` loads `GET /v1/users/me`, syncs
  `AuthProvider` via new `setUserFromServer`, staggered section entrance (`framer-motion`).
- **`ExamSettingsCard`** — KPSS/YKS/LGS radiogroup (`PATCH /v1/users/me`); optimistic select +
  rollback; §1 caption (official dates from editorial, not LLM).
- **`ProfileHeader`** — Nuton thumb disc (`#D6DBFD`), display name, email, verified chip.
- **`AccountLinksCard`** — Nuton list rows: `/abonelik`, logout.
- **`NotificationSettings`** refactor — `@mentor/ui` `Button`, 44px checkbox rows, Card wrapper only
  (no duplicate outer shell).
- **Infra:** `framer-motion` on `@mentor/web`; `--color-accent` token (`#55ACEE`); `setUserFromServer`
  on auth context.

## How to use (usage)
```bash
pnpm --filter @mentor/web dev   # http://localhost:3000/profil
# Select exam type → Panel countdown / Bilgi / Analiz unlock (seeded editorial calendar)
```

## Gotchas
- **Countdown date** still comes from editorial `ContentService` calendar — not `users.examDate`
  (see devnote 0013). Profil only sets `examType`.
- **`usersControllerUpdateMe` openapi typing** is `void` — cast response to `AuthUser` (runtime returns user).
- **Animations:** `useReducedMotion()` disables stagger/scale; exam chip motion uses `motion.button`.
- **`@mentor/ui` theme** — after editing `theme.css`, web picks it up via `@import`; no dist rebuild
  required for CSS vars.

## Related files & decisions
- `apps/web/src/app/(app)/profil/{page.tsx, _components/*}`
- `apps/web/src/lib/auth-context.tsx` (`setUserFromServer`)
- `packages/ui/src/theme.css` (`--color-accent`)
- `apps/web/package.json` (`framer-motion`)
- Decisions: examDate picker deferred; framer-motion web-only; profile loads fresh `me` on mount.
