# Coach brief continuity (2026-09-12, APP-093)

The per-student AI brief had no memory. `coach_students.brief` is one text column, overwritten on
every write, so the second brief about a student started from the same standing position as the
first: it could not know what the previous one had flagged, what the coach had done since, or what
had moved. A coach reading it weekly got a thermometer, not a narrative.

## Two stores, two jobs

- **The link row** (`coach_students.brief` / `brief_at` / `brief_fingerprint`) stays exactly as it
  was: the LATEST text, keyed by a fingerprint of the report, so an unchanged student costs one LLM
  call rather than two. `end()` keeps clearing it.
- **`mentorship_student_briefs`** is new: every brief a model actually wrote. A cache hit appends
  nothing, because nothing was written.

The text lives in both. That is a deliberate trade, not an oversight: removing the cache columns
means a migration on a hot path plus `end()`, erasure and the mapper, and `brief_at` is already the
reference for the open "AI brief transparency" backlog item.

## Period scoping

Rows carry `period_id` and every read is scoped by it, mirroring `mentorship_followups`. Re-linking
rotates `coach_students.period_id`, so a revived relationship reads back empty rather than
resurfacing briefs about a relationship both sides had walked away from (APP-071's rule for the
standing note). `link_id` is a real FK with ON DELETE CASCADE, and erasure DELETES links, so this
table needs no clause in `MentorshipErasureService`.

## The delta is computed, not asked for

`mentorship/domain/brief-delta.ts` is pure and unit-tested, next to `risk-flags.ts` and
`attention.ts`. It compares two stored snapshots and returns `MentorshipBriefDeltaDto`:

- flags arrived / cleared (set difference)
- plan completion, active days, focus minutes, sessions, latest net, mood mean
- mocks entered since the previous brief's newest attempt
- `coachActions`: the attention mark, follow-ups opened and closed, coach-assigned tasks scheduled,
  completed and dropped

Two rules run through all of it. **Absence of data is not movement** — a metric with a null on
either side reports null, never a fall to zero. **Zero is not news** — an identical number reports
null too, so the band does not teach the coach to stop reading it.

`coachActions` is what makes this continuity rather than a diff. The assignment counts are read off
the report the coach is already looking at, not off `plan_tasks`: that table is W2's, and bounding
the counts by the report's own plan window means every number matches something the coach can check
by scrolling.

## What the model gets, and what it does not

Prompt v2 receives the shaped evidence plus the delta, and opens part (1) with the change instead of
a summary of the week. It does NOT receive the previous brief's prose. `mentorship-brief-prompt.ts`
already strips `coachNote` because "feeding it back invites the model to agree with it instead of
reading the numbers"; its own last answer is the same failure with compounding, since a reading that
drifted once would confirm itself every week afterwards. Numbers are safe to feed back, prose is
not. The prompt also forbids causal claims: "after the tasks were assigned, completion rose", never
"because you assigned them".

The delta is deliberately NOT part of the cache fingerprint. It is measured against the previous
brief, so storing one moves it — hashing it would invalidate the key for an unchanged report the
moment the brief describing it was stored, and every second call would buy the same text twice.

On the first brief of a period the delta is `null`, not an empty object, and the prompt drops its
delta rules entirely. "Nothing changed" and "there was nothing to compare" are different statements,
and only the first is a brief's to make.

## Surface

`brief-card.tsx` renders `BriefDeltaBand` above the text when a delta exists, and lazily loads
`BriefHistoryList` below it — nothing is requested on mount, keeping the card's existing rule.

Only ARRIVED flags wear the triage vocabulary (`SignalPill`). A cleared flag is no longer a finding
about the student, so it reads as `CalmLabel`; metric movements and coach actions wear no signal dot
at all, because the shell's four hues answer "which signal" and a completion rate is not one.

## Out of scope

Measuring intervention OUTCOME (before/after windows around a coach action) is a separate ticket. It
needs the history this one creates, and it needs a careful answer on correlation. This ticket lists
what the coach did; it does not claim what it achieved.

## Fixed on the way

`buildMentorshipBriefEvidence` passed `report.moodTrend.slice(-TREND_LIMIT)`. `moodTrend` is
newest-first and the mood window is 14 days, so the model was handed the five OLDEST check-ins and
asked what happened this week. Now `slice(0, TREND_LIMIT)`, matching `mockTrend` directly above it.
