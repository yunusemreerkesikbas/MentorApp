# Onboarding redesign design

## Intent

The pre-auth welcome, authentication, and post-signup questions form one calm Puhu-led journey. The experience emphasizes companionship and one small next step rather than feature density or urgency.

## Experience

- Welcome has four manually advanced scenes: Puhu introduction, AI coach, today's small step, and community. Skip lands on the final signup/sign-in choice.
- Desktop authentication progressively splits the welcome scene into Puhu narrative and the existing form. Mobile retains the bottom sheet and hanging Puhu. Successful authentication exits upward.
- Post-signup onboarding uses named steps and a fixed five-part progress model: username, avatar, exam, conditional KPSS level, and goal. Avatar and goal are optional.
- Puhu speaks in a polite live region, reacts to focus, and moves to the center for the final confirmation.
- A provider in the locale layout keeps the final cloud cover alive while the dashboard or pending invite route mounts.

## Asset contract

Custom assets are opt-in through `apps/web/src/lib/onboarding-assets.ts`. Until the complete asset set is delivered, existing Puhu artwork and CSS clouds are intentional fallbacks. No video, backend change, migration, or new runtime dependency is required.

## Accessibility and motion

All progression remains available through explicit buttons and keyboard navigation. Intro motion can be completed immediately with input. Titles receive focus after a step change, speech uses `aria-live="polite"`, and reduced-motion replaces choreography with short fades.
