# Analysis progress: Quiet Precision

## Direction

- Restrained, true-white product surface with graphite text, cool neutral controls, and green used only for meaningful status.
- Apple Settings-style segmented period control with an interruptible sliding selection; Linear-like action hierarchy and list density.
- The focus selector and review CTA form the primary command band. Plan tracking remains an inline disclosure, not a nested card.
- Four metrics stay typographic and scannable. Review history remains a list with a quiet schedule lozenge and directional pagination.

## Interaction and states

- The shared `MenuSelect` owns focus selection and keyboard/listbox behavior.
- `SlidingTabs` owns 7/30-day selection, arrow-key navigation, and reduced-motion behavior.
- Primary, secondary, tertiary, disabled, loading, error, empty, mobile, and desktop states keep the existing data flow and localized copy.
- Touch targets remain at least 44px; focus rings and non-color status cues remain visible.

## Scope

Production redesign of `/analysis?tab=progress` only. The generated visual mock is a hierarchy reference, not a source for sidebar changes, fake page counters, or new data.
