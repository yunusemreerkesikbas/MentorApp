# 0031 — W3 · Web AI Coach UI (`apps/web` /koc)

> Date: 2026-06-16 · Scope: web (apps/web) + api-client regen · Related: roadmap §1, DESIGN.md, AGENTS §4,
> builds on AI chat backend [0030](./0030-w3-ai-coach-chat-slice1.md). Frontend-only; no API/migration change.

## What was done
- New B2C screen **`/koc`** (in the auth-gated `(app)` group): the premium AI coach chat — finally makes the
  Slice-1 backend usable by users. **Ephemeral single-turn transcript** (user/coach bubbles in client state
  only; backend is stateless, so the coach doesn't recall prior turns).
- **Premium gate:** `KocShell` loads `subscriptionsControllerGetMine()` → `entitlement.isPremium`; free users
  see `PremiumUpsell` (Card + CTA → `/abonelik`). Backend `PremiumGuard` is the real authority (double belt).
- **Components** (all reuse `@mentor/ui` tokens — no new palette): `CoachTranscript` (`role="log"` +
  `aria-live="polite"`, bubbles, empty-state suggestion chips, "yazıyor…" affordance), `CoachComposer`
  (auto-grow textarea, **Enter = send / Shift+Enter = newline**, busy/disabled, SVG send button, focus return),
  `PremiumUpsell`.
- **§4 #1 visible:** a composer caption tells the user the coach won't give official dates/process — check the
  knowledge center (backend already refuses). Sets correct expectations for the no-RAG slice.
- **api-client regen:** `openapi:export` + `generate` produced `aiChatControllerReply`; wrapped in
  `apps/web/src/lib/coach.ts` (`sendCoachMessage` → `{ reply, model }`, study-sessions.ts cast pattern).
- **Nav:** "Koç" added to `NAV_ITEMS` (6th item; thin-line SVG icon, active `--color-main`).

## How to use (usage)
```bash
pnpm dev   # api :3001 + web :3000 (AI_PROVIDER=fake → deterministic coach reply)
# premium/STAFF user → /koc → type + Enter; free user → upsell → /abonelik
```

## Gotchas
- **Ephemeral transcript:** messages live only in React state (no persistence, no server memory). Suggestion
  chips prefill + focus the composer; each send is an independent stateless call.
- **Errors:** `ApiClientError.body.message` is already localized → shown verbatim (403 shouldn't reach the UI
  since it's premium-gated; 404 ai-disabled / 429 rate-limit / 503 provider surface as a chat error line).
- **Composer placement:** sticky `bottom-16` (above the mobile tab bar) / `lg:bottom-0`; safe-area inset padding.
- **Token discipline:** only existing CSS vars; SVG icons (no emoji); 44px touch targets; `prefers-reduced-motion`
  disables the typing dots; transcript auto-scrolls to bottom.
- **Nav now 6 items** on the mobile tab bar — still fits 375px; revisit if a 7th lands.
- **api-client generated file changed** (regen) — committed with this slice. Endpoint surfaced via `@ApiTags("ai")`.

## Related files & decisions
- `apps/web/src/app/(app)/koc/{page.tsx, _components/koc-shell.tsx, _components/coach-transcript.tsx,
  _components/coach-composer.tsx, _components/premium-upsell.tsx}`
- `apps/web/src/lib/coach.ts` · `apps/web/src/components/app-nav.tsx` (Koç entry + CoachIcon)
- `packages/api-client/openapi.json` + `src/generated/*` (regen)
- **Verified:** web typecheck + build green; live preview (premium chat reply, Enter/Shift+Enter, suggestion
  chips, free upsell, error states; mobile 375px + desktop; keyboard/focus + reduced-motion).
- Decisions (owner): ephemeral transcript; nav-visible + in-screen upsell; api-client regen; non-streaming.

## Backlog (next slices)
- Multi-turn + server-side conversation history · streaming (SSE) · RAG source-link rendering (when Slice 2
  backend lands) · coin→AI spend UI · photo→categorize upload.
