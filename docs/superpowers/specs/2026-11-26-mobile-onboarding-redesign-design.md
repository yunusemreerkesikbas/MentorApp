# Mobile onboarding redesign — design

Date: 2026-11-26 · Branch: `feature/APP-142-notebook-entry-manage` · Owner decision: scope = welcome + all onboarding steps, approach A (videos bundled).

## Intent

The mobile app is going to the stores. Its welcome screen and post-signup onboarding are still the
old plain build: dark list rows, a "Puhu" text label, no mascot, no art. The web has the redesigned
Duolingo-pattern flow led by Puhu (2026-09-15, see `onboarding-redesign-direction` memory and
DESIGN.md §2.5 / §1). The first thing a store user sees is the mobile welcome, so it must carry the
same look and story as the web. Success: a new Android user goes welcome → signup → onboarding →
panel and sees what a web user sees, in the same order, with the same copy and art.

Findings this closes (ledger `.superpowers/parity/2026-11-25-mobile-dev/ledger.md`, onboarding
comparison): **O-1** design gap, **O-2** missing avatar upload and push-reminder ask, **O-3** copy
differences.

## Goals

- Welcome: four swipeable slides "Puhu'nun bir günü" with the web's scene videos (play once and
  hold; reduced motion shows the end frame), "Devam et" on 1–3, "Atla" jumps to 4, slide 4 shows
  "Başlayalım" + "Zaten hesabım var". Existing invite-only / waitlist routing is kept as it is.
- Onboarding steps restyled to the web's play language: Puhu with a speech bubble heading, play
  progress bar (no "Adım n / 7" text), icon-well choice tiles, career grid with soft-3D career Puhus,
  daily-goal cards with Puhu poses, play CTA (`#55ACEE` fill, ink `#0F2233`, 4dp `#3B8FD0` ledge,
  16 radius, 800 headings), "Yolun hazır" window with the chosen field's Puhu and a summary.
- Profile step: optional photo upload (reuse the settings avatar upload).
- Daily-goal step: push permission asked in the same tap as "Devam", under a Puhu context layer with
  "Şimdilik geç"; the summary shows the reminder row when it was granted.
- Copy: the web's onboarding and welcome strings, word for word (TR + EN).

## Non-goals

- No change to the step order or the onboarding state machine (`@mentor/core`
  `nextOnboardingStep` / `previousOnboardingStep` / `onboardingProgress`); it already matches web.
- No API changes. No new art: every image and clip exists in `apps/web/public`.
- The web's cloud hand-over animation into the panel is left out (plain replace to the panel).
- The become-coach wizard (`/koc-ol`) is not part of this round.
- iOS-specific polish; Android emulator is the QA target as in the rest of the round.

## Anti-goals

- A flow that looks right but drops a step's save (exam, variant, why, field, goal, profile) or
  sends a user back into onboarding after finishing.
- A welcome that blocks on video: a refused or slow clip must still show the poster and stay usable.
- Asking for notification permission with no context or no way to skip.
- Selling Premium anywhere in this flow (no mobile Premium sales).

## Constraints

- Expo SDK 58 / RN 0.88, expo-router, TanStack Query; `expo-video` already used
  (`recap-character-video.tsx`, `chest-scene.tsx`) and bundled clips already ship (weekly recap).
- Assets are `require`d from `apps/web/public` as the app already does (`../../../../web/public/...`).
  Welcome clips: `apps/web/public/visuals/onboarding/welcome-scene-{1..4}.mp4` (~3.7 MB total) plus
  `-start.webp` / `-end.webp` posters (~0.3 MB). Career art: `mascot/career-3d/<group>.webp`
  (check it is bundled; the app currently bundles `mascot/career`). Puhu poses:
  `mascot/puhu/motion/*.png` (web `PUHU_MOTION_FRAMES`).
- Mobile tokens already carry the play set (`playSelected`, `playLine`, `playTrack`, wells) in
  `@mentor/ui` `tokens.ts`; the CTA/ledge colours come from DESIGN.md §2.5 / `theme.css`.
- Theme: onboarding surfaces follow the phone's light/dark like the web (`--color-bg`), only the
  play accents are fixed. Chrome over art (frost, scrim) keeps one look in both themes.
- Touch targets ≥ 44dp, screen-reader labels, reduced motion respected (DESIGN.md §1, `mobile.md`).
- Push: `registerDeviceForPushNotifications({ requestPermission: true })` in
  `lib/push-notifications.ts` (used by `notification-channels-card.tsx`).
- Avatar: the upload used by `settings/profile-edit-sheet.tsx`; one live upload ticket per user.
- Mobile `(onboarding)` opens only for incomplete users and is not deep-linkable; QA needs a fresh
  test account (passwords never written anywhere).
- Components stay small (split near 250–300 lines); `step-shell.tsx` (323) and
  `goal-profile-steps.tsx` (414) are already over and get split as they are rewritten.

## Approaches

| | What the user sees | Cost | Picked |
|---|---|---|---|
| **A · Videos bundled** | The four scenes play on first open, offline too, exactly like web | App grows ~4 MB | **Yes** (owner, 2026-11-26) |
| B · Stills only | Same slides, no motion (no glide-in, no city lighting up) | ~0.3 MB, least work | No |
| C · Videos streamed | Plays when online; slow first open shows the poster first | No size cost, depends on the server | No |

Why A: the welcome is the store user's first impression; the weekly recap already bundles clips the
same way, and ~4 MB is small next to the app.

## Decided parts of the how

- Welcome scene component plays the active slide's clip from the start, holds the last frame,
  pauses others, poster = first frame; reduced motion = end still. Neighbours preload.
- Shared play primitives for mobile (mirroring `apps/web/src/components/onboarding-play/`):
  `PlayHeading`/`PuhuBubble`, `PlayProgress`, `PlayChoice` (icon well tile), `PlayFooter` (play CTA
  + back), `MinuteEntryCard` if the custom-minutes entry stays.
- Push ask: the daily-goal "Devam" tap opens the Puhu layer and requests permission in the same
  handler; "Şimdilik geç" always resolves the wait; already-decided permission skips the layer.
- "Yolun hazır": career Puhu inside the lit window (`--play-window-*`), summary rows for goal,
  field and reminder, CTA to the panel.

- **Slides show once** (my call, mirrors web `markWelcomeSeen`): a stored "seen" flag; a returning
  logged-out user (logout, failed restore, `(onboarding)` redirect) lands on slide 4, so both
  "Başlayalım" and "Zaten hesabım var" are one tap away and login is never pushed behind signup.
- **Coaches get the new look too** (my call): coaches share intro, exam, KPSS level, profile and
  complete with students, so `coachProfile` is restyled with the same primitives and "Yolun hazır"
  takes the web's coach variant (coach copy and rows, no field Puhu). No old step components are kept.

- **Coach entry** (owner, 2026-11-26): slide 4 keeps a small "Koç musun?" text link under
  "Başlayalım" / "Zaten hesabım var". It goes where today's "Koç olarak başla" goes
  (`/(auth)/signup?role=coach`, or `/(auth)/waitlist?role=coach` when the waitlist is on). New copy
  (no web string exists), Puhu voice, TR + EN; 44dp target.

## Left to the builder

- Exact file split and naming under `components/onboarding/` and a new `components/onboarding-play/`.
- Swipe implementation (paged `ScrollView`/`FlatList` vs a pager) as long as swipe, buttons and
  screen readers all move between slides.
- Whether the mobile "Kendi hedefin" custom-minutes field stays (keep it only if the web has the
  same entry; otherwise follow web).
- Small motion choices (enter fades, selection bounce) within reduced-motion rules.
- Tests: pure logic only (`node:test`), e.g. slide/step helpers; QA on the emulator with a fresh
  account, evidence under `apps/mobile/.expo/qa/<date>-onboarding-redesign/`.
