# Işık Yandı: achievement scene prototype

Motion prototype and video renders for the redesigned achievement celebration
(`apps/web/src/components/achievements/achievement-celebration.tsx`). The copy already says
"Yeni bir ışık yandı", so the scene shows exactly that: the task's ✓ becomes a spark, night falls,
the light gathers, the student taps (or 1.5 s passes) and it comes on, the badge is born out of the
flash and flips out of its Puhu-marked back, then flies home to the avatar.

The reference was Duolingo's chest → card reveal. Kept: full-screen colour change, anticipation
before the burst, white particles, the comet swoosh around a 3D card flip, corner twinkle, glint
sweep, card toss, return to context. Left out: the chest and the "tap for a chance to upgrade"
mechanic. An achievement here is a trace of effort, not loot (`docs/copy/voice.md`: hak, not ödül).

## In the app

The film ships as `apps/web/src/components/achievements/scene/` (phase B). `timeline.mjs` and
`engine.mjs` are mirrored by `scene-choreography.ts` and `scene-engine.ts`, the drawing by
`paint-*.ts` and `scene-frame.ts`, and `sfx.mjs` by `apps/web/src/lib/achievement-scene-sfx.ts`.
Change a beat in both places and re-render, so the film stays the spec. What the app adds: the
spark leaves from the student's last press, the light can be lit with Enter or Space, a tap after
the burst skips to the end of the reveal, and a failed close brings the scene back.

## Renders

| File | What it shows |
| --- | --- |
| `renders/isik-yandi-tek.mp4` | Panel → mark the task done → 7th flame → spark → tap to light → **Ritmi Yakaladın** → fly home |
| `renders/isik-yandi-deste.mp4` | Backfill summary, dark theme: no tap (lights by itself), three cards flip and fan out |
| `renders/isik-yandi-azaltilmis-hareket.mp4` | `prefers-reduced-motion`: same reward, crossfades only |
| `renders/storyboard-*.png` | Key frames with timestamps |

1080 × 1080, 60 fps, H.264 + AAC. The sound is synthesised from the timeline's cue list
(`sfx.mjs`); the chime is the app's own E5 → G♯5 → B5 from `lib/achievement-sound.ts`.

## Files

- `engine.mjs`: cubic-bezier, the damped spring (same equation and units as framer-motion's
  `{ type: "spring", stiffness, damping, mass }`), velocity kicks, keyframes, a seeded PRNG.
- `timeline.mjs`: every beat, spring and per-achievement light colour. The React port reads its
  constants from here.
- `scene.mjs`, `panel.mjs`, `index.html`: the scene and the panel it rises out of. Nothing animates
  by itself; `window.scene.seek(t)` paints any frame from scratch, so captures are frame-exact.
- `render.mjs`: static server + Playwright → ffmpeg. `sfx.mjs`: the sound track.
- `fonts/`: Nunito (SIL OFL 1.1, `fonts/OFL.txt`), vendored so a render never needs the network.

## Run

```bash
# Live preview (any static server from the repo root):
npx http-server . -p 4173   # then open /design/achievement-scene/index.html?scenario=single&play=1

# Re-render (needs Playwright's Chromium and an ffmpeg with libx264 + aac):
node design/achievement-scene/render.mjs all              # or single | deck | reduced
node design/achievement-scene/render.mjs single --storyboard
node design/achievement-scene/render.mjs single --frames=3.8,4.7   # QA stills
```

`FFMPEG_PATH` points at a specific ffmpeg; `PLAYWRIGHT_PATH` at a Playwright module that
`import "playwright"` cannot resolve (for example a global install).
