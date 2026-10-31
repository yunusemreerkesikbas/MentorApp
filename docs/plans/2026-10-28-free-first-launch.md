# Free-first launch preparation

Approved owner direction, 2026-10-28: start with suitable free services, then consider the
lowest-cost paid option only when measurements show why it is needed. There is no fixed
total monthly budget target. Do not auto-upgrade, enable paid overages or auto-recharge.

## Execution

1. Replace obsolete operating-budget requirements in the four earlier planning documents.
   Preserve historical measurements, mark the always-on paid profile as an alternative, and
   distinguish alerts from controls that actually stop consumption.
2. Record current provider allowances, exhaustion behavior, billing exposure and release
   gates. Measure the existing queue/readiness behavior locally with synthetic data. Evaluate
   free hosting in a rehearsal before accepting its cold starts or quota outages in public.
3. Replace Postmark delivery with Resend behind the existing EmailPort. Keep TR/EN templates,
   HTML/link safety, production fail-fast validation, queue retries and send-time token guards.
   Use Free with transactional overages disabled; account/domain acceptance remains a live gate.
4. Run focused delivery/security/admission checks and the deployment configuration check;
   review the complete change. Record live acceptance separately from local test results.

## Acceptance

- No obsolete total-budget requirement remains; unrelated published provider prices stay intact.
- Every service has an explicit free allowance, exhaustion outcome and paid-upgrade condition.
- No paid resource, account-wide billing change or security exception is introduced.
- Real-provider errors do not fall back to another provider or print tokens/recipients to logs.
- Real cold-start signup, verification/reset mail and scheduled maintenance must pass before
  the free hosting profile is selected for publication. Local tests cannot establish that result.
- Public registration remains the intended mode; invited admission stays disabled. Initial
  expected usage is at most eight people, not a permanent account cap.
- AI stays off during acceptance. The separately selected application AI allowance is one
  dollar per month before activation; it is not a provider invoice guarantee. Payments, SMS,
  sponsorship and ads retain their release gates.

See [the evidence and provider matrix](../qa/2026-10-28-free-first-launch.md). No new public
API, database schema, queue architecture or hosting-provider migration is part of this package.
