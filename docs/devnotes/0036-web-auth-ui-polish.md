# 0036 — Web auth UI polish

> Date: 2026-06-16 · Scope: web · Related: DESIGN.md, frontend.md, landing [0035](./0035-web-landing-page.md)

## What was done
- Shared `AuthShell` for all `(auth)` routes: Mentor branding, motion card, “Ana sayfaya dön” link.
- `AuthNavLink` for cross-page nav (44px touch, heading font, no bare underline).
- All auth pages use `SectionHeading` + consistent form spacing; KVKK checkbox min touch target on kayıt.
- `eposta-dogrula` success copy without emoji; eslint-safe `useEffect` with active flag.

## How to use (usage)
```bash
pnpm --filter @mentor/web dev
# /giris · /kayit · /sifremi-unuttum · /sifre-sifirla · /eposta-dogrula
```
- New auth page: wrap content in layout (already `AuthShell`); use `SectionHeading`, `Field`, `SubmitButton`, `FormError`, `AuthNavLink` for links.

## Gotchas
- `AuthNavLink` children must be plain `string` (avoids React 19 / Next `Link` ReactNode type clash).
- Landing funnel points to `/kayit` and `/giris` — keep CTA paths aligned.

## Related files & decisions
- `apps/web/src/app/(auth)/_components/auth-shell.tsx`
- `apps/web/src/app/(auth)/_components/auth-nav-link.tsx`
- `apps/web/src/app/(auth)/layout.tsx`
- `apps/web/src/app/(auth)/giris/page.tsx` (+ kayit, sifremi-unuttum, sifre-sifirla, eposta-dogrula)
- Decision: auth shell matches landing Nuton tokens; motion via shared `stagger-motion` patterns in shell only.
