# 0040 — W4 · Web Abonelik UI polish (`apps/web` /abonelik)

> Date: 2026-06-16 · Scope: web (apps/web) · Related: [0015](./0015-payments.md), premium upsell
> [0034](./0034-w3-web-koc-ui-polish.md). Frontend-only; no API change.

## What was done
- **`AbonelikShell`** — extracted from page; header fade + stagger; `SectionHeading` status card;
  plan grid motion; trial consent checkbox 44px touch + `aria-describedby`; `ApiClientError` messages;
  loading/error states; “Panele dön”.
- **`CheckoutResultContent`** — motion header + card; chip-style badge (no emoji); primary CTA
  “Koça git” on success; Link-as-button tokens; Suspense loading fallback.

## How to use (usage)
```bash
pnpm --filter @mentor/web dev
# http://localhost:3000/abonelik — consent → Denemeyi başlat → provider → /abonelik/sonuc?status=...
```

## Gotchas
- **Trial consent** checkbox still mandatory before checkout (§7) — `disabled={!consent}` unchanged.
- **Cancel** still uses `window.confirm` — native dialog; no custom modal this slice.
- Checkout redirect (`window.location.assign`) unchanged — provider-hosted flow.

## Related files & decisions
- `apps/web/src/app/(app)/abonelik/_components/abonelik-shell.tsx`
- `apps/web/src/app/(app)/abonelik/sonuc/_components/checkout-result-content.tsx`
- `apps/web/src/app/(app)/abonelik/{page.tsx,sonuc/page.tsx}`
- Decisions: success funnel CTA → `/koc` then panel; motion matches Bilgi/Analiz patterns.
