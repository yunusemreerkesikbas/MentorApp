# Weekly Wrapped access, earned first report and durable ownership

Date: 2026-11-01. Status: approved for implementation by the user and implemented behind a
default-on admin switch, as requested after verification. Starting Coin policy: two reports per rolling 30 days, no lifetime cap,
25 Coin per report. Production configuration and deployment are outside this development change.

## Objective and confirmed decisions

- Keep ordinary analysis and basic statistics available to Free users. Gate the full Wrapped story
  and its personal AI narration together as one report, with server-side access enforcement.
- A Free user may explicitly claim one complete report, including AI, after email verification and
  sufficient weekly evidence. This is an earned first-week right, not recurring unconditional AI.
  The earned report is separate from the Coin allowance; Premium use does not consume it.
- Free users can purchase at most two distinct reports with Coin per rolling
  30 days, with no lifetime cap. The allowance is shared across all exams; rereads, the one-time
  earned report and Premium access do not consume it.
- Use the same model and narration quality for earned, Coin and Premium access. Each report has at
  most one successful AI narration generation. There is no user-facing regeneration action.
- Save reports opened through any of these access paths. Provide a small owned-report archive.
  Subscription expiry does not revoke an already opened report; rereads do not debit or generate.
- Admin controls the effective access policy through the existing validated, audited config registry.
  Settings changes must not revoke an already acquired report.

## Current implementation and why it must change

- `GET /v1/coaching/weekly-review` currently exposes the deterministic story to authenticated users
  without a Premium/Coin gate. Its builder is also used by internal evidence and offer consumers.
  Separate protected public story delivery from internal evidence and free summary computation.
- `DeepAnalysisService` already provides a durable ledger-backed AI unlock for `(user, exam, week)`.
  The catalog Coin price defaults to 25; there is no lifetime purchase cap. Reuse the debit and
  idempotency infrastructure rather than introducing a second wallet.
- `ai.features.weekly.narration.free_*` grants a rolling seven-day metered taste, not a lifetime
  first-report grant. Do not leave it as an alternative path around the new report policy.
  Explicitly migrate/deprecate weekly-specific policy; do not change other AI feature tastes.
- Narration currently checks access before looking up the cache and regenerates when the source
  fingerprint changes. Neither behavior satisfies durable rereads and one generation per report.
- The story page fetches only the previous completed week. Durable ownership therefore needs an
  owned snapshot plus archive lookup, not just a new button or a frontend-only paywall.
- UI access discovery currently depends on `economy.enabled`. Premium and earned report access
  must be discoverable independently of whether new Coin purchases are enabled.

## Approved policy and lifecycle

1. Offer reads are side-effect-free. Return report readiness, existing ownership, available earned
   access, Premium inclusion, Coin quote, window used/remaining counts, the next available purchase
   time and localized denial reasons.
   Do not spend Coin, consume the earned grant or call a model on navigation/teaser rendering.
2. Require an explicit open/claim confirmation. The owned-report identity is `(user, exam, week)`;
   purchase/grant quotas are user-wide. A unique database constraint and a short atomic claim serialize competing
   requests across tabs and exams. Pending Coin/earned claims reserve their respective allowance.
3. Reuse an owned report before checking new-access quota, subscription or purchase switches.
   Once generated, its narration and story snapshot are frozen; later edits do not trigger AI.
   Failed generation may retry the same report and does not create another successful usage.
4. Settlement: persist a valid generated report before atomically committing a Coin debit
   and ownership through Economy's public transaction interface. Provider/validation failure does
   not spend Coin or consume a successful earned/Coin use. Do not hold a database transaction across
   the model call. Reuse the current plan-preview claim/settlement pattern where it fits.
5. Bind mutation retries to user, report identity and confirmed quote. Reject stale prices before a
   new generation/debit. Completed retries return the same owned report. A settled report cannot
   be sold again even when its purchaser has exhausted the rolling purchase allowance.
6. Preserve saved report reads when new purchases, earned grants or AI generation are disabled.
   New generation still respects global AI availability, budget reservations and rate limits.
   Account erasure deletes private report/narration content through each owning module; never delete
   or rewrite append-only Coin history.
7. Do not charge for EMPTY/PARTIAL weeks or consume the first earned report before READY evidence.
   Count successful Coin acquisitions by settlement time in the preceding configured duration,
   not page views, model retries, failed purchases or Premium activity. Pending acquisitions reserve
   capacity until settled/expired; expose the earliest time a slot can become available. Existing
   completion/quest events must require an accessible report and stay idempotent.

## Admin controls

| Control | Initial value / behavior |
| --- | --- |
| Rollout / enforce report access | Enabled by default; admin can override; migration required before deployment |
| Earned first-report access enabled | Enabled within the new rollout |
| Earned lifetime report allowance | 1 |
| New Coin report purchases enabled | Enabled within the new rollout, also requires economy enabled |
| Coin report allowance per rolling window | 2; zero means no new Coin acquisitions |
| Coin purchase window | 30 days; rolling duration, not a calendar-month reset |
| Coin report price | Preserve `economy.coin.deep_analysis_cost`, default 25 |
| New AI narration generation enabled | Uses global AI/budget controls; saved reports remain readable |

New controls use `coaching.weekly_recap.{access_enabled,free_enabled,free_limit,coin_enabled,coin_limit,coin_window_days,ai_enabled}`. Do not add a new
model tier or weaker Free/Coin prompt. Reuse the existing admin screen, typed schemas, hints and audit
trail. Effective settings apply to later mutations, with price confirmation on purchase. The registry's
current cache is process-local; do not promise distributed instant invalidation without addressing it.

## Ownership boundaries

- Coaching owns deterministic weekly evidence and completion. AI owns the composed report snapshot,
  archive, generation claims, narration and usage/budget accounting. Keeping the paid artifact in AI
  reuses its existing dependencies and erasure flow without a reverse module import; Coaching gates
  public delivery through the registered report policy.
- Economy owns immutable Coin debits and its public purchase-count/debit operations.
- Payments remains the source of Premium entitlement; report ownership is not a subscription tier.
- Reuse the registered-port pattern (`CoachingEntitlementRegistry`, `WeeklyAnalysisAccessRegistry`)
  to share decisions without reverse module imports or cross-module table reads. One canonical
  feature policy must drive the story gate, narration, purchase and Coin-use catalog.
- Shared API contracts remain in `@mentor/types`/`@mentor/validation`; generate the OpenAPI client.
  Use additive `/v1` contracts where necessary and preserve successful authorized response shapes.
- New private storage is user/org scoped and RLS protected. Generate forward-only Drizzle migrations;
  do not edit the existing in-progress plan-preview migration.

## Delivery slices

1. **Enforced report offer and ownership foundation:** define contracts, private report identity and
   readiness/access policy behind rollout. Add denial tests for direct story/narration/completion
   requests and confirm free statistics still work. Keep internal evidence free from public gates.
2. **Earned first report:** explicit claim, verified-email/evidence checks, one lifetime grant and
   the full successful report. Test concurrent claims across exams, retry, failure and Premium use.
3. **Coin acquisition:** retain the existing quoted price, enforce the rolling two-report allowance in
   the same transaction boundary as settlement, and count qualifying existing purchases in the window.
   Test duplicate requests, competing last-slot claims, insufficient balance and stale prices.
4. **Durable AI report:** integrate one-generation claims, immutable story/narration snapshots and
   budget enforcement; remove fingerprint-driven regeneration for owned reports. Verify successful
   rereads survive quota exhaustion, subscription expiry and switches without new model calls.
5. **Web access and archive:** show included/earned/Coin/Premium actions, remaining Coin allowance,
   clear price confirmation, the next available Coin purchase time and the owned-report list.
   Avoid auto-claims on page load. Preserve
   responsive story playback, TR/EN static copy, sharing and accessibility.
6. **Admin and verification:** expose clear audited controls and validate effective changes in real
   API/browser journeys. Update coaching/AI/economy timelines and API catalog. Run focused tests
   during iteration; shared contracts/migrations need wider checks, and full CI is a merge gate.

These milestones were implemented through focused policy, storage, acquisition, UI and verification steps.
`tasks/plan.md` and `tasks/todo.md` already contain unrelated incomplete pilot work; preserve them.
This feature's plan and verification records live under `docs/plans/` and `docs/qa/`.

## Operational details

- **Counting rule:** count existing ledger-backed weekly Coin
  acquisitions settled in the preceding 30 days. Older acquisitions do not reduce current capacity;
  all existing rights remain valid, including accounts already above the new window limit. New
  purchases resume when the successful/pending count falls below the effective allowance.
- **Price:** retain 25 Coin.
- **Introduction rule:** the new one-time earned grant is available once to eligible Free
  accounts, including existing users; historical metered AI calls alone do not consume this grant.
- **Historical archive:** old purchases have a ledger right but may have no frozen story snapshot.
  Reconstruct historical reports from surviving deterministic evidence and reuse stored narration;
  do not invent an unavailable historical snapshot or regenerate existing successful narration.
- **Locale:** preserve the original stored report/narration language. UI chrome remains TR/EN.
  Switching locale does not translate the saved artifact or trigger another generation/purchase.
- **AI outage:** offers refuse new inference when AI/budget is unavailable and do not suggest
  Premium as a remedy. Stored narration can still be materialized without inference; saved reports
  remain readable. The UI provides a refresh action, and unavailable new reports never debit Coin.
- **Recovery:** successful output and cache persistence are fenced by the generation claim. A late
  expired worker cannot publish over its replacement. Accepted generated results retain their
  original price, and a Premium claim valid at acceptance can finish if the subscription expires
  during generation. These are accepted requests, not permission to initiate another report.

## Verification baseline and acceptance

Read-only baseline on the current checkout: both existing focused suites passed, 24 tests total:

```powershell
# From apps/api; uses the already-installed runner without fetching a package manager.
node node_modules/vitest/vitest.mjs run --config vitest.unit.config.ts src/modules/ai/application/weekly-review-narration.service.spec.ts src/modules/economy/application/deep-analysis.service.spec.ts
```

This verifies existing unit behavior only, not the proposed policy or the whole workspace. Runtime
implementation must additionally prove server-side gating, free statistics, first-earned eligibility,
two successful Coin acquisitions per rolling 30 days, cross-exam/concurrent enforcement, no charge on failure, no second
generation/debit on reread, durable archive access, dynamic admin changes and tenant isolation using
disposable database tests and mobile/desktop browser journeys. No paid provider or production setting
was used or changed during this planning session.

Implementation verification is recorded separately in
[the scoped QA report](../qa/2026-11-01-weekly-recap-access.md).
