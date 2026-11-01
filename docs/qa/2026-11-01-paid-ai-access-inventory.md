# Paid student AI surfaces and Coin access (2026-11-01)

Scope: evaluate existing student-facing paid flows, especially plan-page coaching, the panel's daily
greeting and chat. No new Coin sink, price, entitlement or production flag change is introduced.

This is the pre-implementation inventory. The subsequent approved implementation adds an explicit
plan Coin path behind an off-by-default flag and fixes the greeting/photo findings below. See
[the implementation design](../plans/2026-11-01-earned-plan-preview-design.md) and the latest AI
feature timeline. Original observations and test counts here describe the audit snapshot.

## Current access map

| Surface | Access / accounting today | Coin path |
| --- | --- | --- |
| Plan: Koçla planla, weekly draft and adaptation | `plan.ai`: Premium or a configured capped Free taste. Draft/adaptation share usage; configured generation cap defaults to five per rolling 24 hours. The Free taste defaults off, limit one. Preview only; applying confirmed changes is a separate coaching operation. | None. A large Coin balance does not unlock the wizard/preview. |
| Panel: Güne koçunla uyan | `daily.greeting`: Premium or configured capped taste, default off/one. The hook requests an allowed note automatically. Cache is keyed by user, UTC day and locale. Free users otherwise retain the deterministic motivational line and see a Premium nudge. | None. Opening the panel never spends Coin. |
| AI coach chat / regeneration | Premium/valid trial or a capped `coach.chat` taste; otherwise earned Coin when economy is on. Default five Coin per billable AI request; Free Coin requests default to five per rolling 24h, Premium to 30. Calibration/local replies need no debit. Refunds compensate failed billable requests; repeated spend references do not re-run the model. | Implemented. Opening/access probing does not debit. Prices stay outside the chat composer; only message counts are displayed there. |
| Weekly review AI narration | Premium, capped weekly taste, or durable purchased exam/week right. | Implemented, default 25 Coin per exam/week. |
| Extra notebook capacity | Permanent +1 custom notebook slot; default at most two purchases. | Implemented, default 20 Coin, both price and cap admin configurable. Does not change other Free quotas. |
| Streak rescue (non-AI) | Buys a freeze for an eligible missed day. Requires both economy and `economy.streak_rescue.enabled`; the latter defaults to false. | Implemented behind the separate flag, default 20 Coin. Not a Premium/AI unlock; inspected in source, not exercised in this browser slice. |
| Mood AI reflection | `mood.reflection`, Premium/capped taste; deterministic safety/base behavior is separate. | None. |
| Post-session AI reflection | `session.reflection`, Premium/capped taste; keyed to owned completed session. | None. |
| Ghost/comparison AI narration | `ghost.narration`, Premium/capped taste and sufficient exam evidence. | None. |
| Vision-board AI note | `vision.note`, Premium/capped taste; owned board required. | None. |
| Photo AI classification / notebook prelabel | Premium or configured `photo.categorize` taste, monthly gate and global budget. Categorizes, never solves. | None. |

All billable generation still depends on global AI availability, budget and applicable usage limits.
`economy.enabled` governs Coin access; it does not disable Premium plan/greeting access by itself.
Owning Coin, a notebook slot or a weekly report right does not set `isPremium` and does not unlock
unrelated Premium surfaces. Talking about planning inside an entitled chat is a different capability
from the structured plan-page wizard; they currently have different access policies.

## Verified behavior and coverage

- **111 existing unit tests passed** across chat/access, draft/adaptation, daily greeting, mood,
  ghost, vision note, session reflection and photo access/classification.
- **25 HTTP/Postgres cases passed:** five new access-inventory cases plus the existing 20 chat
  regressions. A Free account funded with 100 fixture Coin still receives
  `PAYMENT_PREMIUM_REQUIRED` on plan, greeting and the other gated text surfaces. No model is called
  and no Coin is spent on those denials. The same account gets `COIN` chat access at five Coin.
- A one-use Free plan taste can generate a draft without spending Coin; adaptation and another
  draft are then refused by the shared plan allowance even with Coin remaining.
- Premium plan and greeting work while economy is off and do not debit Coin. Premium greeting
  reuses its cached note; global AI-off still rejects both features.
- **Current Free greeting policy:** after a one-use taste generates a note, another request is 403
  because `PremiumFeatureGateService` runs before the stored-note lookup. The frontend's policy
  hint exposes only `freeEnabled`, not remaining usage. This is relevant before introducing a
  purchasable daily right: generation ownership and rereading must be defined explicitly.
- **Two real-browser scenarios passed (mobile and desktop):** a Free account earns 20 Coin via
  profile/email quests, then sees the Premium paywalls for plan and daily greeting while chat
  opens with five remaining messages. Balance stays at 20 throughout; no generation/chat POST
  occurs simply from navigating to those surfaces. Screenshots were visually checked.
  Actual chat debits/refunds are covered by the HTTP regressions, not this browser navigation test.

Sources: `payments/domain/feature-access.ts`, AI `premium-feature-gate.service.ts`,
`plan-draft.service.ts`, `plan-adaptation.service.ts`, `daily-greeting.service.ts`,
`coach-access.service.ts`, `chat.service.ts`, `photo-access.service.ts`,
web `use-daily-greeting.ts`, `premium-feature.ts`, `today-path-card.tsx`,
`plan-coach-adaptation-action.tsx`, `coach-chat-shell.tsx` and `coach-access-gate.tsx`.

## Follow-up decisions before adding Coin

1. **Plan is the clearest next candidate:** a user explicitly requests one AI preview. Charge once
   for the generation, preserve the preview for rereading/applying, and make regenerated previews
   separate confirmed requests. Do not debit for opening the wizard, reading its evidence brief or
   applying an already purchased preview. Define provider/invalid-output failure compensation,
   cancellation, stale quotes, idempotency and a global budget hold before spending.
2. **Daily greeting needs an explicit action:** the current hook auto-fetches on panel entry.
   Adding a debit there would turn navigation into a purchase. A separate “open today's coach note”
   action with a quoted price can grant a daily right; cached rereads must not spend again. Decide
   UTC-day/locale scope and Free-taste cache behavior first.
3. **Use one feature-owned access decision** for frontend offers, catalog and enforcement. Premium,
   configured tastes and Coin rights must not give conflicting decisions. Add only approved new
   sinks to the current three-item Coin catalog (notebook, chat, weekly analysis; the separately
   gated streak-rescue flow has its own panel offer). New prices/caps require a product decision and
   central admin settings; this audit does not choose them.
4. **Photo quota needs a targeted follow-up:** notebook prelabel records `AiUsageFeature.VISION`,
   while `PhotoAccessService` counts `MockExamService.countPhotoCategorizationsSince`, backed by
   mock-exam photo rows. The notebook path does not write those rows. This is a source-level
   read/write mismatch suggesting that notebook usage is absent from the shared photo quota.
   A repeated-prelabel runtime case was not executed here; verify/fix it before expanding earned
   photo access. Do not treat the passing isolated photo units as proof of this integration.

## Reproduction / environment

New suites: `test/ai-paid-access-audit.e2e-spec.ts`,
`e2e/economy-paid-flows-real-api.spec.ts`. Browser uses the existing opt-in live API fixture,
`playwright.notebook-live.config.ts --grep 'Coin-rich Free'`. API uses a dedicated loopback `_test`
database and fake model/payment/storage providers. Browser accounts earn their own 20 Coin through
real profile/email quest events; no Coin is seeded in the browser journey. No purchase/model call
is triggered merely by opening a gated page. Email delivery is suppressed in the browser fixture.

Logs: `.artifacts/qa/paid-ai-audit-20261101/paid-ai-units.log`, `paid-ai-http.log`,
`paid-ai-browser-final.log`. The first browser run used an exact greeting-button name that missed
its accessible Premium badge; correcting the locator to include the badge resolved both cases.
No production behavior was changed to make them pass.

Targeted API/web TypeScript and changed-test ESLint checks passed. Both task-owned disposable
databases were removed after verification; API/web fixture listeners stopped. No developer or
production database/configuration was changed. These are scoped audit checks; no full workspace
CI/build or deployment was performed.
