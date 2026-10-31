# Bounded storage for the core-only trial

Status: design approved section by section in chat on 2026-10-31. The owner also reviewed
and approved the written plan for inline source implementation. Deployment remains separately gated.
The owner chose to retain photo uploads and to temporarily stop uploads/new image reads
when the aggregate allowance is exhausted. The owner approved the existing-API gateway
direction in section 1, initial limits in section 2, access boundaries in section 3 and
conservative accounting/failure behavior in section 4 and user experience/verification/rollout
in section 5. The written implementation plan was subsequently reviewed and approved in chat.
The disabled-AI candidate and its running CI are unchanged by this design document.

## 1. Goal, scope and alternatives

Bound Puhu's aggregate stored bytes and R2 operations across all users, rather than
assuming eight users or relying on per-user notebook counts. Preserve the existing
5-photo Free allowance, file signatures, upload tickets, session checks and private-media
ownership. Plan, focus, analysis and notebook text must remain usable during media refusal.

Recommendation: route browser media reads through the existing NestJS API and place a
durable shared allowance before every R2 operation. Uploads already use that API. Keep
the single backend, pg Pool and RLS; do not add another API, Redis or a paid service.

| Approach | Benefit | Limitation |
| --- | --- | --- |
| API media gateway and Postgres allowance, recommended | One enforcement boundary for browser/server reads and writes; existing ownership and deployment model | Media consumes Render bandwidth and needs cold-start/DB acceptance |
| Cloudflare Worker gateway and separate atomic allowance | Media can stay at the edge | Adds another deployment, credentials and consistency boundary; unnecessary for this trial |
| Upload-only allowance plus alerts | Smallest change | Direct public/signed reads remain unbounded; does not meet the selected requirement |

This bounds the new Puhu trial buckets only. Existing Craftive, dev and staging resources
remain unchanged. Cloudflare's Free allowance is account-wide and alerts do not stop usage.
Puhu's application allowance cannot guarantee a zero account invoice when other workloads
consume that shared allowance. No paid-overage authorization is implied by this design.
The owner declined additional staging setup/cost/development on 2026-10-31. Use one
selected Free core-trial environment, accepting providers with synthetic data before user
admission. Do not add a second hosted application, staging deployment pipeline or staging-only
code. Retained historical staging resources are outside this implementation and stay idle.

## 2. Proposed limits and stop behavior

Owner-approved initial deployment-wide limits in the central registry:

- **500 MiB** of stored bytes plus unresolved write reservations.
- **10,000 Class A** and **100,000 Class B** attempts for the whole attended trial.
- No automatic calendar reset or refill. Changing a cap requires a recorded operator
  decision; restarting, redeploying, changing a DB override or running a second instance
  must not reset usage. Stored-byte accounting never resets while objects remain.

Lifetime trial counters avoid treating UTC calendar months as Cloudflare billing cycles.
These values are conservative trial allocations, not official Free quotas or a billing
cap. Confirm current shared headroom before provisioning and monitor other account use.
No zero/unlimited setting is permitted in the guarded trial profile.

When a relevant cap is exhausted, reject the operation before R2 with a stable localized
temporary-media error. New media reads may stop; existing images already in browser memory
cannot be revoked. Do not delete files, clear notebook references, change premium entitlements
or display an upgrade demand. Confirmed deletion remains available after exhaustion.
Capacity can recover after confirmed deletion; operation allowances need operator review.

## 3. Read boundary and deployment

### Approved transfer addendum (2026-10-31)

The owner additionally approved a **1 GiB (1073741824 byte) lifetime media transfer allowance**
after reviewing Render's shared 5 GB Hobby bandwidth and no-card suspension behavior.
Each PUT charges its actual validated payload; each raw read charges the known full object size
before provider work. Retries are new reservations; failures and deletion do not refund transfer.
Server-side copy/list/delete/empty-bucket probes transfer no object body through the API and
reserve zero payload bytes. Existing storage and Class A/B ceilings remain unchanged.

Store this counter and each reservation's charge durably under the same lock. New initialized
scopes start at zero; migrated historical usage stays unknown and refuses normal access until
reviewed, rather than silently receiving a new allowance. URL minting and HTTP HEAD do not spend
payload capacity. Media refusal still preserves core DTOs and study actions.

This bounds media object payload, not headers, control requests, pages/assets, database traffic
or unrelated projects. It reduces the chance that photos consume the shared Render allowance;
monitoring and hosted acceptance remain required. No extra staging or service is introduced.
Source: [Render outbound bandwidth](https://render.com/docs/outbound-bandwidth).

Both new EU buckets must have public/custom-domain and r2.dev access disabled. Keep public
prefixes logically public, but serve them through an allowlisted API route. Private reads
use short-lived capabilities issued only after existing owner authorization, bound to the
object and live session. Recheck capability expiry/session revocation before accessing R2.
Never return a direct S3 presigned URL, bucket credential or private object in a public route.

Keep StoragePort's existing feature-facing shape: callers still request a URL or object.
URL generation itself does not access R2 or spend an operation. The gateway validates
prefix/manifest/ownership and reserves allowance when bytes are requested. Backend reads,
copies, lists, upload completion and cleanup use the same guarded raw storage boundary.
Unknown keys, invalid capabilities and unsupported methods fail before provider calls.
Read denial must not make the entire notebook or vision-board data response fail.

Use the existing API hostname for media routes, keeping the two selected Free Render
custom domains. Do not add a third Render domain or activate media.puhukoc.com. Exact public
URL/CSP settings are finalized from real service hostnames. The existing edge-origin guard
and Cloudflare header protection apply; no client receives the edge secret.
Private media is no-store and must not enter shared Next/Image/CDN caches. Any bounded
public caching must preserve the prefix boundary and may only avoid R2 calls, never create
an unmetered provider path. New trial buckets start empty; pre-existing bucket activation
requires a separate reviewed inventory/migration, not guessed zero usage.
Capability paths/query values must be removed from logs, Sentry and referrers, including
raw request fallbacks before a route matches. No private capability is shared between users.

## 4. Accounting and failures

Storage owns the budget, object manifest and reservation records behind repositories in
shared/storage. Access uses service context with explicit RLS; feature modules do not query
these tables. Use a forward-only generated migration and small services, not another queue
or event-sourcing framework. Counters update under a transaction lock before network work.

Reserve the maximum object bytes before PUT/copy and the maximum billable attempts before
each raw operation. Cover HEAD plus GET, copies, orphan lists, retries and failures. Set a
finite explicit SDK attempt policy and account for every allowed attempt; no hidden retry
may exceed its reservation. Unknown pricing is not needed for operation/byte enforcement.
Do not release operation usage after a timeout or provider error. Do not repeat an uncertain
write under the same reservation or free its bytes until absence/deletion is confirmed.

On confirmed upload success, settle the object's actual byte count. On crash or ambiguous
completion, retain the conservative reservation; recovery inspects known keys within its
own allowance. Delayed deletion does not release bytes until the provider acknowledges it.
Deletion is free under current R2 Standard operation pricing and remains independently
bounded/retry-safe for privacy cleanup. A list failure is not proof of an empty bucket.
In particular, an uncertain or still-pending PUT can complete after a cleanup DELETE;
its byte reservation is not automatically freed by that DELETE acknowledgement. Retain
the conservative hold until a quiescent, recorded operator reconciliation establishes
the final object state. Ordinary confirmed objects can release bytes after confirmed deletion.
No runtime role receives bucket-management permissions. Outside scripts/provider consoles
must not write to trial buckets during the accepted bounded run.

## 5. User experience, verification and rollout

The server returns a stable temporary-media code and TR/EN message without global usage,
provider error details or signed capabilities. Image surfaces show a calm temporary state;
text editing, plan/session actions and saving existing notebook data keep working. The Free
5-photo entitlement remains separate from this deployment-wide capacity decision.
An export requiring unavailable photos must report that condition and preserve the editor
state, rather than silently downloading a document with missing images. New cached-image
fallbacks must not remove notebook entries or saved vision-board items.

Required RED/GREEN coverage includes: simultaneous last-slot operations, multiple processes,
restart persistence, all prefixes/roles, repeated URL reads, direct-path denial, invalid and
revoked/expired capabilities, cross-user reads, SDK retries, partial/crashed writes, copy/list
and cleanup paths, deletion after exhaustion, and no provider call after refusal. Preserve
ticket/privacy, capability-redaction and closed-AI/social/admin suites. Use isolated loopback fixtures and synthetic
media. Require full CI on a new exact reviewed commit before any hosted use.

Hosted acceptance then checks private buckets, scoped EU credentials, actual requests versus
reservations, cold starts, image/browser privacy, Render bandwidth, Neon consumption and a
small finite provider-call budget. No credential upload, real media, DNS, bucket, billing or
scheduler change is authorized by this draft. Rollback must preserve enforcement; reverting
to direct unmetered URLs is not a compatible rollback. Retain files and accounting on rollback.

## Evidence and review checkpoints

- 2026-10-31 read-only account view: R2 overview 120.7 MB, 70 Class A, 4.08k Class B,
  current-period billable usage USD 0. Billing rollup separately shows 0.08 GB-months,
  69 Class A, 3.48k Class B and observed/projected USD 0. These are different UI rollups.
- The existing USD 10 alert was viewed, not changed; it sends notifications only.
- No puhu-prod buckets exist. Existing EU puhu-s1 buckets remain empty and unchanged.
- Source: SecureStorageService returns direct 300-second private URLs; public URLs bypass
  the API; UploadTicketRepository's daily allowance is per user. The quota gap is real.
- Owner behavior choices, the section-1 existing-API gateway direction, section-2 initial
  limits, section-3 access boundaries and section-4 accounting/failure behavior are approved
  in chat. The owner also approved section-5 user experience/verification/rollout and requested
  the implementation plan. No extra staging environment or staging-specific development is selected.

Sources: [R2 pricing and operation classes](https://developers.cloudflare.com/r2/pricing/),
[budget alert behavior](https://developers.cloudflare.com/billing/manage/budget-alerts/),
[Render Free limits](https://render.com/docs/free).
Repository references: [storage setup](../core/storage-r2.md),
[prior preflight](../qa/2026-10-29-storage-monitoring-preflight.md),
[architecture](../core/architecture.md), [backend standard](../standards/backend.md).
