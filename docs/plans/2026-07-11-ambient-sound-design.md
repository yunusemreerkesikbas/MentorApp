# Ambient Sound (Odak Fon Müziği) — Design

> **Status:** MVP slice (client-only). Roadmap originally listed ambient sound as Phase 2 in
> [`coaching.md`](../features/coaching.md); this lean slice pulls forward the companionship layer
> without backend or social infra.

## Purpose

Study sessions (`/seans`) already use an immersive focus/break UI. Optional ambient sound softens
loneliness during long focus blocks — aligned with the companionship platform spirit (AGENTS §0).

## Scope (v1)

| In | Out |
|---|---|
| 1 looping ambient track (`focus-ambient.wav`) | Backend preference sync |
| Toggle + volume in focus/break phases | Coin / premium gate (§4: no coin in session zone) |
| `localStorage` persistence | Multi-genre picker, Spotify, crossfade |
| Pause audio when session pauses; stop on done/abandon | Break-specific track (same track for v1) |

## UX

- **Default:** sound **off** (user opt-in; respects browser autoplay policy).
- **Placement:** compact icon button beside session controls in immersive view (focus + break).
- **Gesture:** first enable happens on toggle click → satisfies `play()` user-gesture requirement.
- **Volume:** fixed comfortable default (0.35); stored preference includes volume for future slider.

## Technical

- **Assets:** `apps/web/public/audio/focus-ambient.wav` — static serve via Next.js.
- **Hook:** `useSessionAmbientSound({ phase, isPaused })` — HTML5 `Audio`, `loop=true`.
- **Storage key:** `mentor.session.ambientSound` → `{ enabled: boolean, volume: number }`.
- **Active when:** `phase ∈ { focus, break }` && `enabled` && `!isPaused`.

## Asset license

`focus-ambient.wav` is a **synthesized loop** (30s, seamless loop) generated in-repo via
`scripts/generate-ambient-audio.mjs` (soft sine pad + noise). No third-party music license required.

## Guardrails

- No coin UI or economy hooks on `/seans`.
- No AI cost (pure client audio).
- Calm, non-alarming; off by default.

## Future (Phase 2+)

- User preference in profile / cross-device sync
- R2/CDN hosting if file size or bandwidth matters
- Coordination with live study rooms (shared room ambient policy)
- Break-specific track
- Volume control during focus/break (v4)

## v3 — Preview (2026-07-11)

| In | Out |
|---|---|
| ~5s preview on dropdown change (idle only) | In-app volume slider (device volume) |
| `trackId` + `muted` in localStorage | Backend sync |

- **Preview:** `PREVIEW_DURATION_MS = 5000`; dropdown change = user gesture
- **Gain:** fixed `PLAYBACK_VOLUME` — user uses system volume

## v2 — Pre-session dropdown (2026-07-11)

| In | Out |
|---|---|
| Idle dropdown: off + soft/rain/warm | Backend sync, coin gate |
| Selection before **Başla**; locked for session | Change track mid-focus |
| Focus/break mute-only toggle | Spotify |

- **Catalog:** [`apps/web/src/lib/ambient-tracks.ts`](../../apps/web/src/lib/ambient-tracks.ts)
- **Picker:** `SessionAmbientPicker` on idle setup (subject picker → timer ring)
- **Storage:** `{ trackId, volume, muted? }` key `mentor.session.ambientSound`

## Related files

- `apps/web/src/lib/ambient-tracks.ts`
- `apps/web/src/app/[locale]/(app)/seans/_components/use-session-ambient-sound.ts`
- `apps/web/src/app/[locale]/(app)/seans/_components/session-ambient-picker.tsx`
- `apps/web/src/app/[locale]/(app)/seans/_components/session-ambient-toggle.tsx`
- `apps/web/src/app/[locale]/(app)/seans/_components/seans-shell.tsx`
- `docs/features/coaching.md` (timeline)
