# Weekly report: recap and deep analysis

Date: 2026-11-04. Status: approved by the user for implementation (option B, shared ownership).

## Product contract

- One report identifies one user, exam and completed Istanbul Monday–Sunday week.
- Its two views are the existing visual recap and a readable deep analysis. One earned grant,
  Coin acquisition or Premium opening includes both. Switching views and rereading never acquires
  another report, spends Coin, consumes allowance or calls an LLM.
- Preserve central settings: current default price 250 Coin, two Coin reports per rolling 30 days,
  one first earned report, and Premium inclusion. No daily AI report or additional price tier.
- Free users see basic weekly numbers and the shared access choice. Show this entry from ordinary
  analysis and point the Premium benefit at the detailed view.

## Content and data

- Show completed-week focus time, active days and completed tasks against the preceding week.
  Missing prior evidence is unavailable, not an invented zero or a percentage improvement.
- Show taxonomy-backed subject net averages and sample counts for both weeks, plus focus time
  and completed tasks per subject. Include subjects with study/task evidence but no mock exam.
- Explain limited evidence without blaming the student or inferring causation from correlation.
- Reuse the existing short AI note and deterministic focus/suggested task. Present these with
  accurate provenance. A comprehensive factual view does not require a second model generation.
- One plan CTA prefills the existing plan flow; saving still requires the student's action.

## Architecture and persistence

- Coaching builds and localizes a structured optional `WeeklyReviewDto.deepAnalysis` from its
  existing aggregate evidence. Pure calculation helpers remain framework-free.
- AI's existing report claim, generation, settlement and access checks remain canonical. The
  deep analysis is frozen inside the existing JSON review snapshot, requiring no schema migration.
- Archived reports without the optional data still show their original summaries and AI note.
  Explicitly explain that prior-week and per-subject detail was not saved; do not reconstruct
  paid snapshots from today's mutable evidence or initiate another model request.
- Keep the existing `/v1` endpoints and use `view=analysis` on the recap route. An owned report
  can switch between views locally; direct deep links still pass the same server access gate.
- Preserve TR/EN translations, native keyboard access, responsive layout and design tokens.

## Verification and delivery

1. Add tests for two-week calculation, missing/negative data, subject-only activity and privacy.
2. Add optional shared contract and deterministic backend detail; verify existing recap policy.
3. Add deep-analysis view, shared navigation and discoverable Free/Premium entries.
4. Verify earned/Coin/Premium opening, no extra requests on view switches, historical snapshots,
   incomplete weeks, language and mobile/desktop layout. Record feature timelines.

Targeted checks during iteration; no production configuration changes or deployment in this task.
