# Auth desktop shell design

## Goal

Make login and signup feel like the next beat of the welcome/onboarding journey. On desktop, the
form must sit inside a balanced centered composition instead of hugging the viewport edge, and the
signup form must not create a nested scrollbar.

## Layout

- Keep the current mobile bottom sheet and hanging Puhu unchanged.
- Use a centered desktop stage with a shared maximum width and two columns: narrative first, form
  second. The form column is slightly wider than today so legal copy wraps less.
- Let tall desktop forms grow naturally. The document may scroll on short viewports; the form card
  must not become its own scrolling region.

## Narrative

- Reuse the onboarding visual language: a bordered speech bubble above the waving Puhu frame.
- Keep the existing localized auth title and supporting copy. No new claims or additional copy.
- Use existing play, surface, border, typography, shadow, and focus tokens only.

## Responsive and motion

- The narrative remains desktop-only. Mobile keeps the existing compact sheet and hanging mascot.
- Preserve the first-paint CSS entrance/exit choreography and reduced-motion behavior.
- Verify 375px mobile plus 1280px desktop. Desktop regression coverage checks that the form has no
  nested vertical scroll, retains a calm viewport inset, and exposes the onboarding-style bubble.

