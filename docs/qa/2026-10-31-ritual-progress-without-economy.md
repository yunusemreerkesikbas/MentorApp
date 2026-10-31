# Ritual progress without economy rewards: verification

Date: 2026-10-31. Scope: the owner-approved separation of ritual progress from XP/Coin rewards.
No production deployment, development feature-flag change, real payment, email or AI request was performed.

## Result

- The authenticated quest endpoint remains available with economy disabled. Completion uses existing
  progress rows; reward metadata is NONE/zero. Closed-period completions do not receive retroactive
  grants when economy reopens. Existing enabled-mode caps, idempotency and rollback tests still pass.
- Dashboard/profile rituals remain reachable. Balances, XP/Coin amounts, monetary chest/purchase
  offers, receipt delivery and earning celebrations are gated. Closed responses invalidate cached
  balances and in-flight balance results; open quest sheets retain progress without reward amounts.
- The shared contract shape is unchanged; NONE was already supported. No migration or dependency
  was added. Reopening is picked up on a fresh document, without a live flag subscription.

## Checks

| Check | Result | Limits |
| --- | --- | --- |
| Economy backend unit suites | 187 passed, 15 files | Fakes for repositories/providers; modified quest suite also rerun separately, 32 passed. |
| Quest and core-only trial HTTP/Postgres suites | 15 passed, 2 files | Fresh isolated loopback test database, fake providers; database removed after checks. |
| Balance store and dashboard path unit suites | 15 passed, 2 files | Includes disabled state, late response suppression and absence of a monetary chest for NONE rewards. |
| Targeted browser checks | 8 passed | Chromium mobile 375x812 and desktop 1280x800; closed progress/actions, closed celebration, open-to-closed sheet/nav, existing mood/task flows. Browser API responses are intercepted; actual disabled server behavior is covered separately by HTTP tests. |
| API and web TypeScript checks | Passed | Package compiler checks, not the entire workspace pipeline. |
| Touched backend/web ESLint and diff whitespace | Passed | Existing unrelated dirty files excluded from owned-file lint. |

The tests first reproduced missing closed-state progress and retroactive reward issuance. During browser
verification, the fake panel was corrected to retain saved mood and return an empty unread-reward list
for the open-economy scenario, matching actual API behavior. Mobile assertions target visible navigation
rather than the hidden desktop duplicate. The final eight-case run passed in an available development
API environment; earlier runs during API watcher restarts are not counted as acceptance.

## Follow-up boundaries

The existing development instance still reports economy=true. This change implements closed behavior;
turning that environment off remains a separate operational action. Full workspace CI/build and hosted
acceptance were not run. The earlier chat replay and unavailable-analysis debit findings are outside
this selected slice and remain unresolved.

Related: ../plans/2026-10-31-ritual-progress-without-economy.md and ../features/economy.md.
