# Invited production pilot: draft plan

Date: 2026-10-13. Status: registration/admission source package complete in PR #157;
measured cost profile prepared, approved daily-email control in PR #158 under full CI.
Release-profile decisions and provisioning remain pending.
Task list: [todo.md](./todo.md).

Integration observed 2026-10-13: PRs #157 and #158 were merged outside this task while
the notification checks were running. Notification source head is `c72d88bb`; the combined
master merge is `5a7d59bf`. Full CI is still pending, so integration alone is not validation
or evidence of deployment.

## Confirmed decisions

- First release: an invited pilot of 20-50 users on `puhukoc.com`.
- Admission method: an explicitly configured list of invited email addresses. No invitation-code
  system is part of the first pilot. Enforce the same admission decision for password and Google signup.
- Total monthly operating budget ceiling: USD 50; minimize cost while measuring performance.
  This is a planning ceiling, not authorization to create paid resources or accept overage terms.
- No permanent staging. Preserve the archived work and retained Neon/R2 resources.
- Keep the existing NestJS/Next.js/Neon/Render/Cloudflare boundaries and production protections.
- Keep `info@mentor.com`. Do not copy staging credentials into production.
- PR #156 was integrated into `master` while pilot development was running; both preparation
  CI runs passed at `85241507`. Its integration was performed outside this development task.
  No deployment has been performed by this task.
- Preserve unrelated mentorship changes in the shared checkout.
- Existing Postmark plan confirmed by the owner: Free, 100 messages/month.
- The owner selected in-app/push daily reminders for the pilot. The approved source change
  adds an explicit reminder-email setting, preserving inbox/push and guarded verification/reset.
  Branch `feat/pilot-notification-budget`, PR #158; no live flag or provider plan was changed.
- The owner approved the first package: shared registration closure and invited-email admission
  in an isolated worktree/PR. Implementation branch: `feat/invited-pilot-registration`, based on
  production-preparation head `85241507`; it does not modify the primary checkout's parallel
  coach work. Pilot PR #157 now targets `master` and contains only the pilot package.

## Findings that determine the order

1. `signup.enabled` exists in the config catalog, but neither password signup nor Google account
   creation reads it. A pilot must enforce admission in the API, not just hide the signup UI.
2. Notification jobs poll the DB every 10 seconds by default. A continuously running API can
   therefore keep Neon compute active even with no users. The measured empty poll uses four
   SQL statements, and Render readiness probes independently query the DB. Do not assume a
   polling interval change can make this topology fit Neon Free.
3. The current production Blueprint contains three paid apps and four cron services. Render's
   advertised compute is USD 7/app/month plus at least USD 1/cron/month: an approximately USD 25
   hosting floor before custom-domain, bandwidth, build, database, email, AI or tax costs.
4. Neon Free includes 100 CU-hours/month. Continuous 0.25 CU for a 30-day month is 180 CU-hours;
   low user count alone does not prove the Free plan is sufficient.
5. Postmark Free has 100 emails/month; Basic is advertised at USD 15/month. The existing account
   is confirmed Free. Remaining quota and sending-domain acceptance still need verification;
   the owner selected pausing daily email rather than upgrading the plan.
6. Cloudflare Access activation remains unresolved because the owner declined card-overage
   authorization. Do not weaken admin guards or accept those terms to meet the budget.

Sources checked 2026-10-13: [Render pricing](https://render.com/pricing),
[cron billing](https://render.com/docs/cronjobs),
[Neon Free limits](https://neon.com/blog/neon-free-plan-1-gb-per-project),
[Postmark pricing](https://postmarkapp.com/pricing).
These are published prices/limits, not an account-specific quote or a promise of a USD 50 bill.
Latest account evidence, local measurements, current pricing corrections and the approximately
USD 37–38 lean base proposal: PR #158, `docs/qa/2026-10-13-pilot-cost-profile.md`.
Render's actual Hobby allowance is 5 GB outbound / 500 build minutes / two custom domains.
Admin publication and acceptable Access remain unresolved; no security exception is introduced.
Initial cost allocation assumes AI disabled. The actual catalog default monthly AI cap is 0,
meaning no cap, not zero spend. Set a finite positive cap only after agreeing AI scope; do not
activate the pilot with that unbounded default. No live AI setting was changed.

## Proposed development slices

### 1. Cost and performance profile

Compare the current Blueprint with a lean pilot profile using existing providers. Keep the
student web/API responsive; evaluate infrequent admin use and only necessary scheduled jobs.
Measure notification polling, idle DB activity and email latency before changing scheduling.
Do not replace the queue architecture or omit maintenance merely to lower the estimate.

Acceptance: an itemized account-aware estimate fits below USD 50 with a usage/tax reserve;
DB quota and provider-stop behavior are explicit; no assumption that budget alerts hard-cap billing.
Verification: read-only account/provider checks, local idle/load measurements, notification tests.
Dependencies: none. Likely files: deployment runbook, Render profile, notification runner/catalog
only if measurements justify a subsequent scoped change. Checkpoint: approve the deployment profile.

### 2. Enforce the existing registration stop switch

Use one Identity admission policy for new accounts, wiring password and Google creation in
separate small increments. Reject new account creation when registration is closed, while
preserving existing login, reset, linking, CAPTCHA and rate-limit behavior.

Acceptance: direct API calls cannot bypass the switch; password and OAuth creation share the
decision; failures are localized/generic; existing users retain the intended access.
Verification: focused policy/service tests for closed/open signup and existing-user OAuth,
followed by isolated API regressions. Dependencies: none; provider billing is not required.
Likely files per increment: policy/spec, one auth service/spec, module wiring (at most five).
Checkpoint: review this independent bug fix before adding pilot-specific admission.

### 3. Invited pilot admission

Use the owner-selected invited-email list for the first cohort. Enforce the same policy in both
account creation paths. UI explains the pilot in TR/EN. Proposed acceptance behavior:

- Closed registration rejects every new account, including invited addresses.
- Pilot admission allows only exact normalized email matches; an empty list allows nobody.
- Reuse existing email validation/normalization. Do not collapse provider-specific aliases or dots.
- Validate list entries and duplicates; enforce the agreed configurable cohort limit.
- Keep addresses server-side; do not publish the list in public config, HTML or logs.
- Removing an address stops future admission; account suspension/revocation uses the existing
  user-status mechanisms. It must not silently delete an existing account.
- Public registration remains an explicit mode transition, independent of the invitation list.
- Preserve CAPTCHA, rate limits, email verification, OAuth identity checks and role policies.

Acceptance: uninvited users cannot create accounts through password or Google; selected cohort
limit is enforced; email lists/tokens are not publicly exposed; public-mode behavior is tested.
Verification: focused API admission cases, concurrency cases if capacity is mutable, and browser
flows. Dependencies: slice 2 and admission-behavior review. Implement API and UI separately,
then document the feature. Likely areas: Identity policy/config, web auth flow, identity feature doc.
Checkpoint: owner approves the user-facing admission flow and operator procedure.

### 4. Pilot journey and usage bounds

Proposed first journey: signup/verification, onboarding, daily plan, study session, mock-exam
analysis and return on the following day. Agree separately whether human-coach flows participate.
If AI is enabled, retain existing entitlement/earned-right rules, per-user limits and the monthly
reservation cap. Do not grant unconditional Free AI. Determine the AI sub-budget from slice 1.
Check transaction-email volume and keep other feature rollouts behind their existing gates.

Acceptance: the selected journey works on mobile/desktop; AI cannot exceed configured rights/cap;
mail quota failures are observable; no new feature rollout is implicit in pilot signup.
Verification: journey/browser tests, focused entitlement/budget tests, realistic pilot load evidence.
Dependencies: slices 1 and 3 plus explicit feature/AI decisions. Likely areas: registry overrides,
existing relevant tests and feature docs; preserve the parallel mentorship workstream.

### 5. Production provider acceptance

After approving the profile, prepare dedicated production secrets, Postmark sender verification,
Turnstile/R2, acceptable admin Access, DNS/TLS, monitoring and DB restore/rollback evidence.
Use the existing production runbook. Public exposure and provisioning remain separate decisions.

Acceptance: no stage-secret reuse; restricted runtime DB role passes; origin/Access checks and
actual email/storage flows pass; secrets do not appear in logs or browser configuration.
Verification: release checklist and read-only/prepared provider evidence before applying changes.
Dependencies: slices 1-4, resolved Access terms and provisioning authorization.

### 6. Reviewed release and pilot observation

Require full CI on the exact reviewed release commit. Once publication is authorized, open the
pilot gradually up to the selected cohort and track successful onboarding, return use, errors,
mail/AI/DB usage and total cost. Record rollback/registration-stop procedures and review findings.

Acceptance: exact commit is traceable, critical flows pass, expenses stay inside agreed allocations,
and the owner can stop admission/AI exposure without changing production security.
Verification: full CI, production smoke, error/usage measurements and review checkpoint.
Dependencies: slices 1-5, PR review and separate merge/release decision.

## Open decisions

- First admission package approved; review the concrete PR and its verification before integration.
- Pilot feature scope: student journey, human coach involvement and bounded AI exposure.
- Postmark remaining quota/sender acceptance; monthly provider allocations and reserve.
- Admin Access without unapproved overage authorization; measured hosting/DB profile.
- Performance targets for the pilot, based on the measured starting point.
