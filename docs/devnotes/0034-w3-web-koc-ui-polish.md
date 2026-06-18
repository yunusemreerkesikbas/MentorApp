# 0034 — W3 · Web Koç UI polish (`apps/web` /koc)

> Date: 2026-06-16 · Scope: web (apps/web) · Related: [0031](./0031-w3-web-koc-ui.md),
> DESIGN.md, Panel/Profil motion patterns. Frontend-only; no API change.

## What was done
- **`KocShell`** — header fade-in + subtitle; eslint-safe subscription fetch (`active` flag);
  `FormError` for load errors.
- **`CoachTranscript`** — framer-motion bubble enter; Nuton chip-styled suggestion buttons;
  coach bubbles use translucent card tokens; typing dots via motion (no inline `<style>`);
  `FormError` for chat errors; smooth scroll respects `useReducedMotion`.
- **`CoachComposer`** — textarea matches `TextField` surface (`bg-white/50`, white border,
  `shadow-card`); send uses `@mentor/ui` `Button`; sticky bar `bg-white/80` + backdrop blur.
- **`PremiumUpsell`** — header + card motion; `SectionHeading` for upsell copy.

## How to use (usage)
```bash
pnpm --filter @mentor/web dev   # http://localhost:3000/koc
# Premium: chat + bubble animation; free: animated upsell card
```

## Gotchas
- **Send `Button`** — icon-only (`h-11 w-11`); `busy` not passed (avoids "Bekleyin…" replacing icon).
- **Stateless backend** unchanged — ephemeral transcript, no streaming/history (0031 backlog).
- **Composer** still custom `<textarea>` (multiline); tokens align with `TextField`, not the component itself.

## Related files & decisions
- `apps/web/src/app/(app)/koc/_components/{koc-shell,coach-transcript,coach-composer,premium-upsell}.tsx`
- Decisions: motion on bubbles/chips; Button for send; chip tokens for suggestions.
