# Core-only trial: social availability boundary

Status: owner approved implementation on 2026-10-30 after reviewing the scope and current
screen examples. Implementation is in progress; no live flag or provider setting changed.

## Confirmed outcome and discovered gap

The owner selected a small-user Free trial with manual plans, solo focus, analysis,
notebooks and accounts, while admin, AI, community/forum, human coaching, payments, SMS
and ads remain closed. The implemented admin/AI changes do not enforce all other parts.
See [the verification evidence](../qa/2026-10-30-web-release-verification.md) and
[the earlier approved profile](2026-10-29-admin-closed-pilot-design.md).

`forum.enabled=false` does not close identity follow/buddy APIs, other-user profile reads,
invite-created relations or passive buddy notifications. Room routes have their own switch,
but `SessionService.start` accepts an existing member's `roomId` without checking it.
The room notification target seam also assumes that starting a room session was gated.
These are release blockers for the chosen scope, not evidence that personal study tools
must be removed.

## Options and recommendation

1. **Dedicated social availability, recommended.** Add a central
   `community.social.enabled` switch, preserving current behavior by default. Explicitly
   set it false in the trial. Keep forum, room, ranking, economy, mentorship and AI switches
   separate. This makes identity relations independently closable and avoids coupling a
   buddy's private activity signal to discussion-board maintenance.
2. Extend `forum.enabled` to every social operation. Less new configuration, but changes
   its meaning and ties unrelated relations/notifications to forum outages.
3. Hide links only. Rejected: direct API requests and background notification listeners
   would remain active.

## Server boundary

- Enforce the social switch at public follow/buddy service boundaries before reads/writes
  or domain events. Include relation creation reached through invite redemption; prevent
  partial redemption side effects or promises of a relation that was not created.
- Reject other-user profile and achievement-collection reads when social availability is
  false. Preserve the viewer's own personal profile/collection and self-scoped
  `/community/summary`; do not blanket-deny the controller or change role semantics.
- Suppress cross-user buddy/room notification branches before delivery-deduplication state
  is recorded. Preserve personal first-session/progress notifications and account cleanup.
- Require `coaching.study_rooms.enabled` whenever session creation includes `roomId`.
  Existing membership is insufficient. Preserve solo creation and finalization/history of
  already-started sessions. Gate room target resolution as well, so queued events cannot
  bypass closure.
- Keep existing admin/AI production requirements and security guards. No new database
  schema, service, provider, role removal or generic operator endpoint is needed.

## Shared interface availability

Add one typed, non-secret `GET /v1/app/availability` contract backed by the central registry,
with effective booleans for AI coach, social, forum, study rooms, human coaching, purchasing,
and public student/coach admission. Existing-account coach registration remains independent of
new-account signup, matching the existing server admission policies. Return only explicitly selected public capabilities,
not arbitrary config values, secrets, entitlement or another user's data. Reuse a single
frontend loader/provider; derive composed values in the backend and keep user entitlement
checks in their current services. Availability is presentation guidance; each server
boundary remains authoritative. Define cache invalidation/failure behavior in the plan;
an unavailable response must not silently enable closed features.

Use it to hide closed nav/actions, buddy/room blocks and human-coach links; handle direct
URLs and stale post-login/invite destinations with a localized closed state. Existing coach
accounts must retain login/settings without student-data access or redirect loops. The
viewer can still reach their own progress/achievements through avatar/profile links when
their existing exposure flags permit. No redesign or new marketing claims.

## Trial preparation and acceptance

Persist and verify social/forum/room/ranking/economy/mentorship/AI/purchase/ads closures,
`signup.enabled=true`, `signup.pilot.enabled=false`, and coach applications closed.
Keep SMS disabled. Do not rely on catalog defaults or treat expected users as a cap.
No provider setting is changed by this proposal.

| Scenario | Required acceptance |
| --- | --- |
| Student account lifecycle | Public signup, verification/reset, login/refresh/logout/settings work; invalid Turnstile fails; coach-intent signup is refused. |
| Existing coach account | Account access works; closed coach routes reveal no student data or redirect loop. |
| Core tools | Manual plan CRUD, solo focus/completion/history, analysis and notebooks work. |
| Personal progress | Self summary/profile/achievements remain reachable when their own exposure flags allow; other-user reads are denied. |
| Direct social calls | Follow/buddy/forum/discovery/ranking are denied before write/event/query where appropriate. |
| Invites | No new relation or cross-user notification; stale URLs do not hijack onboarding. |
| Existing room membership | `roomId` cannot start a room session while off; solo start and existing-session completion remain usable. |
| Passive/queued events | No buddy/room activity delivery or burned delivery-dedupe marker while closed. |
| Closed paid/provider features | No checkout, SMS, ad-script or AI provider calls; account-safe status reads remain usable. |
| TR/EN mobile/desktop | Closed actions disappear, direct URLs explain closure, core navigation and personal progress remain usable. |

## Implementation sequence and limits

1. Inventory the selected public service/listener callers and current availability contracts;
   write focused RED regressions before adding the server gate and room-start check.
2. Implement/test the typed availability response and minimal shared UI gating; preserve
   the approved notebook/landing design. Add meaningful direct-URL and stale-invite coverage.
3. Update the deployment profile and feature timelines; independent source/security review,
   targeted package checks, then full CI on one fixed reviewed commit.

This supersedes no earlier owner approval. It closes newly discovered paths in the already
selected trial, while making the personal-progress behavior explicit for review. Aggregate
R2 spending, production credentials, official editorial dates, Free-host maintenance,
HTTPS/mail/Turnstile/private-media/monitoring/recovery acceptance remain separate gates.
