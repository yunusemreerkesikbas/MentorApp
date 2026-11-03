# Central exam catalogue and staged exam support

## Agreed scope

The exam family list is code-owned and shared, with no new admin management surface.
Keep KPSS, YKS and LGS, and add ALES and DGS as the first complete group. Subsequent groups
cover language exams, specialist exams, EKPSS and TR-YÖS after verifying their content and rules.
“Kurum Sınavları ve Diğerleri” is a category, not a selectable exam or a generic Other option.

## Design

- `@mentor/types` owns the exam catalogue, stable family codes and variant definitions. Derive
  shared family types and validation choices from it rather than maintaining parallel lists.
- Onboarding, account settings, blog filters and existing admin selectors consume the catalogue.
  Static web copy remains in mirrored TR/EN message files; no new UI system or dependency.
- Content continues to own dated exam instances, verified calendar events, scoring rules and
  subject/topic taxonomy. These are editorial data, separate from the timeless family catalogue.
- ALES and DGS use the existing coaching plan/taxonomy/mock-analysis services. Verify their test
  sections, question counts and scoring against official ÖSYM guides. Topic subdivisions are
  editorial coaching labels, not a claimed official syllabus.
- Keep existing family codes, user selections and historical mock results. No destructive data
  migration or unrelated seed rewrite. Calendar startup seeding remains fill-gaps-only.
- Families without a published target dataset must not inherit YKS programs or KPSS postings.
  Existing KPSS/YKS target functionality stays scoped to those families.
- Admin audience filtering and metrics must include new families without breaking the existing
  metric response fields. Generated OpenAPI/client contracts follow the shared validation.

## Verification and rollout

Start with failing tests for new-family request validation, taxonomy coverage and target-data
isolation. Run the relevant API tests, affected-package typechecks/lint and browser checks for
student/coach onboarding, settings changes and analysis. Document any verification limits.
Do not expose subsequent exam groups as selectable until their required data is ready.

## Execution steps

1. Add the central catalogue and derive shared contracts/validation. Preserve existing exports.
2. Connect selection/filter surfaces, localize ALES/DGS labels, and cover profile variant clearing.
3. Seed verified ALES/DGS instances and subject/topic trees; test countdown rollover and scoring.
4. Scope target data correctly; extend announcements and exam-distribution metrics compatibly.
5. Regenerate API contracts, verify the affected flows, and append feature-document timelines.

## Review focus

No invented dates or scoring defaults; no cross-exam target-data leakage; no deletion of existing
exam history; no accidental inclusion of unrelated working-tree changes. Future language exams
may need different scoring and language/field selection, which this first group does not assume.

## First-group verification (2026-11-03)

- 126 relevant API unit tests passed, including initial seed ordering, countdown rollover,
  shared request validation, metrics, target isolation and net scoring.
- 47 relevant web unit tests passed; all five families have TR/EN onboarding and blog labels.
- 16 Chrome browser tests passed across mobile/desktop: student and coach onboarding,
  completion summaries, KPSS-to-ALES/DGS settings changes and mock-exam submissions.
- API, web and admin typechecks passed; shared packages and regenerated API client compiled.
- Touched-file lint has no errors. The existing admin announcement effect retains its prior warning.
- Independent code review found no actionable introduced issues. Existing exam/taxonomy rows remain
  unchanged. Full workspace CI, production build/deployment and real-database E2E were not run.

Remaining exam groups follow the agreed staged scope and are not selectable in this first group.
