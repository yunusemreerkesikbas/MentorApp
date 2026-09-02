# Onboarding visual assets

Set `CUSTOM_ONBOARDING_ASSETS_READY` in `src/lib/onboarding-assets.ts` to `true` after all assets below exist.

- `coach.png`, `daily-step.png`, `community.png`: transparent 1600×1200 PNG/WebP scenes.
- `cloud-left.png`, `cloud-right.png`, `cloud-bottom.png`: transparent 2048×1024 cloud layers.
- Puhu motion frames live in `public/mascot/puhu/motion/`: `gaze-left.png`, `gaze-right.png`, `blink.png`, `wave.png`, `talk-closed.png`, `look-down.png`.

All Puhu frames must use the same 1024×1024 canvas and character alignment. Until the switch is enabled, the experience intentionally falls back to the existing Puhu art and CSS cloud shapes.
