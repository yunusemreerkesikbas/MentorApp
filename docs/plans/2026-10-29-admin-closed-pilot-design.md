# Admin-closed free trial design

Date: 2026-10-29. Status: **owner confirmed scope and inline execution; local implementation
and targeted checks complete; independent scoped review found no blocking issue**.
The source supports this profile; it is not active on a live deployment and does not
authorize provisioning/publication.
Context/evidence: [launch readiness review](../qa/2026-10-29-launch-readiness-review.md).

## Owner decisions and alternatives

The owner selected free services for a small-user functional trial, with AI/payments/
SMS/ads off until acceptance, and requested a design with all admin access closed.
Public signup remains the earlier direction; expected users are not an account cap.
Uploads remain in first-release scope and their spending gate remains unresolved.

Three paths were considered:

- **Closed-admin trial, selected:** no admin deployment and server-side denial of admin
  operations. Avoids Access enrollment for the trial but removes the operator UI.
- **Existing Access mode:** preserves the current operating model but blocks the trial
  until acceptable account setup resolves the owner's card/overage refusal.
- **Landing only:** smaller infrastructure exposure, but does not exercise the requested
  signed-in application; the owner selected a functional trial instead.

This is a deployment mode of the same NestJS application. No second backend, provider
migration, auth replacement, new dependency or schema migration is proposed.

## Boundary and minimal components

Add a bootstrap environment setting, provisionally `ADMIN_ACCESS_MODE`, with two values:
`cloudflare` (default, preserves current behavior) and `disabled` (explicit trial mode).
It must not be a DB flag that an inaccessible admin panel is needed to configure.

In disabled mode, the existing global admin access guard must deny `/v1/admin/**`
and `/v1/auth/admin/**` before any admin handler, credential verification, token rotation,
Access key fetch or admin write. Valid application/Access tokens cannot override denial.
Reuse backend-localized errors. Unauthenticated requests may still fail earlier at the
existing global guards; no response may report an admin success or issue an admin cookie.
Verify route-prefix coverage against actual controllers, including admin controllers
owned outside AdminModule, rather than assuming module removal closes the surface.

Access issuer/audience validation is conditional on the cloudflare mode only. All other
production validation remains mandatory: HTTPS origins, independent secrets, restricted
runtime role, origin protection, Turnstile, real configured providers and mail. Missing or
invalid mode values must never silently permit admin access. Disabled mode must be
testable without changing NODE_ENV to development.

Keep module/service wiring; disabling AdminModule alone is insufficient because admin
auth lives in identity and reembedding lives in AI. Do not alter role semantics or
tenancy to achieve the trial. With cloudflare mode, retain assertion verification,
issuer/audience, email binding, role checks and MFA deployment acceptance.

Do not deploy `mentor-admin`, attach `admin.puhukoc.com`, or publish a Render admin alias
for the trial. Existing hostname/CORS validation may retain the reserved admin origin;
an allowed CORS origin does not make a denied route accessible. Start from a separately
reviewed Free web/API recipe, not by applying or weakening the optional paid Blueprint.

## Data flow and operation

User -> Cloudflare -> existing origin/CORS/Turnstile/JWT checks -> user API -> restricted
pg Pool with transaction-scoped RLS. Admin requests reach a denial boundary and never
an admin handler. Protected cron endpoints retain their independent secret and scope.

Before the first API start, apply migrations with the separate direct owner connection,
prepare exact reviewed config overrides/content using an attended operator procedure,
and verify the target/values. Never publish setup endpoints or put owner credentials in
the service. The config cache is process-local; any approved offline config correction
requires a controlled restart/recheck so persisted changes are effective.

AI must be false with a positive selected cap (100 cents), sponsorship/ads/paid checkout/
SMS must stay off, and the embedding-provider bypass in the review must be corrected
before claiming zero AI calls. Real-provider startup requirements remain; fake providers
and invented credentials are not the trial solution.

Owner-confirmed trial scope: keep forum and human-coach surfaces closed until moderation
and operator support are available. Self-service planning, sessions, analysis, notebooks
and account operations are in scope. The release configuration must explicitly retain
`forum.enabled=false`, `mentorship.enabled=false`, `mentorship.applications.open=false`,
`mentorship.risk_digest.enabled=false` and `mentorship.seats.sponsorship_enabled=false`.
Closing mentorship alone does not close self-service coach registration; its separate
applications flag must be checked too. Do not change live flags or concurrent notebook
quota code as part of the admin-boundary implementation.

Implementation plans: [closed admin](../superpowers/plans/2026-10-29-admin-closed-trial.md)
and [AI kill-switch](../superpowers/plans/2026-10-29-ai-provider-kill-switch.md).

Without the operator UI, content/config changes, role assignment, moderation and support
actions are unavailable through admin HTTP. Prepare verified editorial content before
admission and an attended, scoped support/incident procedure. No generic SQL console,
public maintenance endpoint or automatic replay is added. If safe support cannot be
provided, keep the trial closed despite successful deployment.

## Verification and rollback

- First add focused regression tests: production boots in disabled mode without Access
  issuer/audience; default/cloudflare mode still rejects missing/invalid Access settings.
- Cover admin config, users, content, reembed and admin login/refresh/logout denials;
  verify zero handler/provider calls, no issued cookie and no token/session mutation.
  Include old privileged sessions, query strings, case/trailing slash and route aliases.
- Inventory all privileged controllers and prove the denial covers every admin route.
  Preserve positive/negative cloudflare assertion and identity-binding regressions.
- Show normal signup/login/refresh/logout, user RLS, origin denials, cron authorization
  and readiness still behave correctly in the intended production mode.
- Run focused API checks during implementation. Full CI and hosted acceptance on one
  reviewed commit are mandatory before publication; source tests do not prove edge setup.
- Re-enabling admin requires an explicit switch to cloudflare mode and working Access/MFA
  before deploying the admin service. Missing Access configuration must fail startup.
  Rolling back to older code restores its Access requirement, so retain a compatible
  closed-mode artifact for trial rollback or stop the service. Never use fake Access
  settings to force an old artifact to boot. Database recovery is a separate gate.

Related implementation surfaces: API `config/env.validation.ts`, `config/env-production-locks.ts`,
`common/auth/cloudflare-access.guard.ts` and their tests; identity admin-auth/HTTP regressions;
deployment env examples/runbook and feature timeline. Any eventual implementation remains
separate from provider account writes, release-secret upload, DNS changes and launch approval.
