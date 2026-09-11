# Coach App Navigation Design

## Goal

Use the existing responsive `AppNav` on every human-coach route (`/students`, coach profile, and
student detail) so coach and student surfaces share the same desktop sidebar and mobile app chrome.
Keep the human-coach authorization boundary and mentorship-specific content unchanged.

## Chosen approach

Keep the `(coach)` route group and `CoachShell`. Replace its duplicated header navigation with the
same shell composition used by `(app)`: `AppNav` followed by a `mentor-app-shell` content wrapper.
`CoachShell` remains responsible for authentication and the `COACH` role guard.

Moving coach routes into `(app)` would couple mentorship routing to student-shell redirects and
message loading. Copying the current sidebar would create a second implementation that can drift.
Direct reuse is the smallest change and preserves the existing route boundary.

## Components and layout

- `CoachLayout` continues to load the scoped coach messages. Its existing scope already contains
  the namespaces required by `AppNav` and the notification drawer.
- `CoachShell` keeps the anonymous redirect, loading state, non-coach guard, and
  `NotificationDrawerShell`.
- The custom coach header and local navigation list are removed.
- Authenticated coaches render `AppNav` once.
- Coach content sits inside `mentor-app-shell` so desktop padding follows the shared expanded or
  collapsed sidebar width.
- Mobile content uses the shared tab-bar padding constant so the fixed header and floating bottom
  navigation do not cover the page.
- Existing coach page content remains centered at its current maximum width.

`AppNav` already filters navigation by role. Coaches receive `/students` and the shared,
coach-compatible destinations while student-only links and the AI coach button remain hidden.

## Data and behavior

No API, contract, persistence, or route changes are required. `AppNav` continues to read auth,
subscription, economy, theme, notification, and sidebar preference state through its existing
providers and hooks. The coach shell only supplies layout placement.

## Error and access behavior

- Anonymous visitors continue to redirect to login.
- Authenticated users without `COACH` continue to see the existing guarded state.
- Backend endpoints remain the security boundary for mentorship data.
- Navigation fetch failures retain `AppNav`'s current graceful behavior and do not block coach
  content.

## Verification

Use only feature-targeted checks:

- Extend the coach-home browser test to assert the shared desktop sidebar and removal of the old
  coach header.
- Assert the shared mobile header and tab navigation on the coach surface.
- Exercise a nested coach route to prove the route-group shell applies beyond `/students`.
- Run the affected coach browser spec and targeted web type/lint checks only if needed by touched
  files.

## Documentation

Append a concise timeline entry to `docs/features/mentorship.md` describing shared `AppNav` usage,
responsive behavior, and the role-filtering gotcha.
