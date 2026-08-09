# Community Hub Editorial Redesign

## Direction

The community hub keeps Mentor's monochrome-forward product language while adopting the reference card's editorial hierarchy. The featured discussion becomes a white, image-led surface with `feed.png` as the single banner-class visual, a strong discussion title, compact participation metadata, and a black primary action paired with a quiet secondary action.

## Component decisions

- The workspace wordmark reads **Mentor**. Its conversation icon is unboxed and uses the same line-icon treatment as the sidebar.
- Zone rows are denser. CHAT, ANNOUNCEMENT, and QA icons have no background tile; message-count copy is removed. Group headings remain because they provide useful scanning structure.
- “Devam ettiklerin” uses compact rows, unboxed header/row icons, and no hover animation. Focus treatment remains visible.
- “Emek Panon” is a community-discovery surface, not a personal economy summary. Streak and XP/coin are removed from its header. The three columns focus on trending tags, supporters, and recommended rooms.
- Empty states teach the next useful action through concise copy and a small text action where a destination exists. They do not use nested cards or dashed placeholder boxes.
- Primary actions use the shared black-button language; secondary actions use a quiet border or text treatment. All interactive targets remain at least 44px.

## Responsive and accessibility

Desktop keeps the existing two-column hub composition. The featured image sits in a reserved upper visual region and the content remains readable without overlays. Smaller screens stack the featured and continuing panels, preserve image aspect ratio, and keep buttons full-width where useful. Images use localized alternative text, keyboard focus remains visible, and no content depends on hover or animation.

## Verification

The implementation is guarded by a focused source contract test for the requested removals and image/brand additions, targeted web typecheck/lint, and a browser screenshot pass at desktop and mobile widths when the local app can run.
