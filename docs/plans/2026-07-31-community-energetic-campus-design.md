# Energetic Campus Community Design

## Direction

Community should feel like an active student campus, not a quiet editorial archive and not a
gamified competition. Energy comes from real people, rooms, replies and contribution states. The
interface remains calm where exam pressure or personal progress is involved.

## Visual language

- Mentor blue (`--color-progress`) is the primary interaction color: selected navigation and primary
  actions. Its existing track and focus tokens provide soft, border, text and hover states.
- Coral identifies questions and invitations to respond.
- Green identifies support, accepted/helpful states and healthy activity.
- Neutral surfaces stay dominant. Accent colors are never used as inactive decoration.
- One sans-serif family, compact product type scale and letter spacing no tighter than `-0.04em`.
- Cards are reserved for grouped objects. Lists use dividers and surface changes instead of a border
  and shadow on every row.
- No gradients, glass cards, fake badges, rainbow room cards, generic pastel blobs or ornamental
  illustrations.

## Surface changes

- Header: recognizable Mentor-blue community mark, stronger search focus and consistent active states.
- Sidebar: simpler navigation, sentence-case group labels and room-type color signals.
- Hub: featured discussion becomes a committed Mentor-blue surface built from the real thread, author,
  tags and community avatars. Recent discussions become one continuous list rather than repeated
  floating cards. Effort data becomes an inline progress sentence instead of metric tiles.
- Feed: Mentor-blue selected tabs and primary actions; cards use type color only for meaning and avoid
  decorative elevation. Context rails use sentence-case headings.
- Composer/detail/room: the same primary, question and helpful state vocabulary carries through.

## Motion and accessibility

State transitions use 150–200ms ease-out motion. No page-load choreography. Reduced-motion remains
instant. Body and placeholder contrast meet WCAG AA, focus rings remain visible, and touch targets
remain at least 44px.

Hover feedback changes color or surface only; icons and controls do not scale. One-line helper copy
that merely repeats a heading is replaced by a semantic icon. Instructional copy remains where it
prevents an error or explains an empty, loading, permission or validation state.

## Verification

Run touched-file lint, the existing web unit suite and `@mentor/web` production build. Visual review
remains manual at 375, 768, 1024 and 1440px; no Playwright visual suite is added.
