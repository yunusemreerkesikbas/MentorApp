# Actionable Analysis — Approved Three-Tab Brief (2026-07-13)

## Outcome

/analiz is one calm path from recording a result to choosing a concrete next study action:

1. **Enter:** fast, aligned, server-validated subject score entry.
2. **Progress:** a primary focus-subject story based on the latest four attempts.
3. **Wrong answers:** photo-classification evidence tied to the same focus window.

The experience uses existing Nuton tokens, personal-progress language, one explicit next action, and no ranking, client-side net calculation, or new chart dependency.

## Decision rules

- Scope focus candidates and photo signals to the active exam's latest four attempts.
- Prefer recent photo evidence; otherwise choose the lowest normalized subject average.
- Break ties deterministically by normalized performance and then stable subjectRef.
- Return newest-first focus points, delta, direction, and backend-localized message.
- Preserve all-time subject averages and existing general trend, personal record, and past-self semantics.

## UI acceptance

- URL-backed keyboard-accessible tabs; no decorative page-load stagger.
- Real four-column desktop form layout and 44 px mobile controls.
- Row-local question-count overflow; all net values remain API-owned.
- Scannable history list without an empty-state flash.
- Primary focus card with latest-four SVG sparkline and Plan prefill CTA.
- Visible photo trust line: classification only, never a solution.
- Explicit no-exam, loading, access, rate-limit, processing-error, and no-signal states.
- TR/EN copy, reduced-motion behavior, focus rings, and responsive layouts.

## Demo and verification

seed:analysis-demo remains deterministic, idempotent, and production-protected. It creates eight weekly attempts with a dip and recovery, varied publishers, and six recent photo signals (3 Turkish, 2 Mathematics, 1 History), making Turkish the repeated-evidence focus.

No migration, endpoint, module, or frontend dependency is added.
