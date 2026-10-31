# Bounded trial storage: verification and attended acceptance

Date: 2026-10-31, Europe/Istanbul. Source implementation only. This record does not authorize
remote migration, bucket/token creation, credential transmission, DNS, billing or publication.
The owner approved the design/inline plan and later the 1 GiB lifetime transfer addendum.

## Source contract

- All trial users/roles share one durable sealed account/bucket/jurisdiction scope and four
  ceilings: 524288000 stored bytes, 10000 Class A, 100000 Class B, 1073741824 payload-transfer
  bytes. No month/restart refill, premium bypass or per-process counter.
- Reservations precede provider calls. One SDK attempt; bounded read with a size cap reserves
  HEAD+GET. PUT/read charge payload; metadata-only copy/list/delete/initialization charge no
  object payload. Used/uncertain transfer and operation charges never refund on deletion.
- Only confirmed settled deletion returns stored capacity. Pending/uncertain PUT holds survive
  cleanup acknowledgement and late completion. Tombstones prevent key reuse.
- Both new EU buckets remain provider-private. Public prefixes use the API; private grants bind
  owner/object/current HTTP session and expire within 300 seconds. Revocation is checked before
  R2. No shared image cache, raw provider URL, logged capability or missing-photo export.
- Notebook/vision evidence without an HTTP actor retains keys/text without private URLs. Media
  refusal preserves DTOs, editor state, plan and solo focus actions. AI/admin/social stay closed.
- Initialization is attended, target-asserted and precharged: two finite empty-bucket probes.
  Unknown historical transfer usage fails closed. No automatic reconciliation/reset endpoint.

## Local evidence

Evidence is under ignored `.artifacts/deployment/bounded-storage-20261031/` and this plan's
SDD ledger. Only guarded loopback `_test` databases and synthetic objects/accounts are used.

| Area | Evidence |
| --- | --- |
| Accounting | Real PostgreSQL last-slot races, separate pools, restart, exact boundaries, RLS, copy size, uncertainty, confirmed/late deletion and transfer retention |
| Actual wiring | Root Nest module selects the guarded raw port and mints only gateway URLs without provider work even at exhaustion |
| SDK | In-memory transport fixtures exercise transient, redirect and clock-skew failures; no hidden second wire request |
| HTTP/session | Actual TokenService/AuthSessionRepository; a revoked session fails while another owner session remains live; prefix/method/HEAD/capacity checks precede provider work |
| Core DTOs | Actor propagation through notebook and vision HTTP paths; data-only evidence and temporary-media preservation |
| Web | 41 export/layout/font/message-scope units, 16 dedicated media browser checks and 20 TR/EN closed-trial browser checks passed; types, targeted lint, build and performance budgets passed |
| Transfer addendum | Four registry defaults pass; real accounting/HTTP coverage passes 29 cases; privacy/account-target regressions reproduced before fixes |
| Migrations | 0133–0135 generated; 254 prior SQL/snapshot files and 133 prior journal entries match base 1513a5bb; applied local 0133/0134 hashes retained |

The original checkout remains `feature/APP-123`, HEAD `4bbd4136`, with its real index empty.
After the transfer addendum, the independent storage checkpoint passed 141 units, 31 local
PostgreSQL/HTTP/factory cases, operator types, targeted lint and migration integrity. The owner
asked to hold final source/release checks while another chat edits landing/economy availability.
No new candidate commit, final whole-candidate review, push or full CI is claimed by this checkpoint.
Owner/Impeccable changes are preserved. The next scoped candidate is based on `1513a5bb` on
`feat/core-trial-release-20261030`. A fresh storage review and complete exact-SHA CI are required;
the earlier disabled-AI CI 41131102949 certifies only 1513a5bb, not these changes.

Local first boot of a fresh fixture database took about 140 seconds. The harness now waits for
the expected profile and web readiness. This is not evidence of hosted startup performance.
Another chat's local API on 3001 was preserved; owned acceptance uses API 3404 and web 3104.
The dedicated CI suite runs after existing core-trial setup and cleans its own unique article.

## Read-only domain and local profile checkpoint

Public DNS was refreshed at 2026-10-31 13:45 Europe/Istanbul. `puhukoc.com` delegates to
Cloudflare (`brian`/`serena`), with existing MX/SPF/DMARC records. The root has no A/AAAA answer;
`api.puhukoc.com` has no A/CNAME answer and `www.puhukoc.com` has no CNAME answer. The domain
is not yet routed to the planned application services. `media.puhukoc.com` has no CNAME,
consistent with the selected API-only media path. DNS was not changed. Evidence:
`.artifacts/deployment/bounded-storage-20261031/dns-refresh.json`.

The local metadata check found `STORAGE_PROVIDER` absent. Preparation now pins it explicitly
to `r2`, alongside bounded mode/EU, rather than inheriting the development `fake` default.
R2 credentials and the verified gateway origin remain intentionally absent; this is a prepared
profile, not a deployable environment. AI/vision/admin/payments/SMS remain disabled. No secret
was transmitted and no full CI was started. Final candidate checks remain on the owner's hold.

## Proposed attended action package: not yet executed

Proceed only after the reviewed candidate's complete CI succeeds and the owner approves the
following concrete provider actions. Keep admission closed until all acceptance gates pass.

### Fixed targets and local preparation

- Cloudflare account: `e1c73aa0d2d2c3cf828d155ffb074d87`; zone `puhukoc.com`.
  Create only `puhu-prod-public` and `puhu-prod-private` in EU after confirming no collision.
  If either exists/nonempty, stop for an inventory review; never overwrite or guess zero usage.
- Disable r2.dev/custom-domain/public access on both. Create Object Read & Write credentials
  scoped to these two buckets only, without bucket-management permission. Retain every
  `mentor-*`, `puhu-s1-*` and Craftive resource unchanged.
- Neon trial project: `falling-bar-88067595`, database `neondb`. Runtime role
  `puhu_trial_runtime`; expected host
  `ep-wandering-wave-b9q3sjwf-pooler.c-7.eu-central-1.aws.neon.tech`, TLS verify-full and
  channel_binding=require. Revalidate these assertions before connecting; no owner URL at runtime.
- The existing private local runtime file is pinned to bounded mode with independent media
  signing material. It has no R2 credentials or finalized gateway origin and is intentionally
  incomplete. Nothing from it has been transmitted. AI providers remain paired-disabled.
- Proposed hosting remains one Render Free API and one Free web service in the existing Hobby
  workspace, no admin/extra staging/scheduler/card/paid upgrade. Keep automatic deploy off.
  Select the reviewed candidate SHA. Reserve `puhukoc.com` and `api.puhukoc.com`; verify actual
  service aliases, DNS and HTTPS before finalizing API/CORS/CSP values. No `media` domain.

### Migration, initialization and secret destinations

1. Recheck shared Cloudflare/Render/Neon headroom and no-card/overage settings. Alerts do not
   stop R2 consumption. Confirm the selected account/workspace and take a verifiable recovery
   point; a branch or migration log alone is not a successful restore test.
2. Apply only reviewed forward 0133–0135 through the separate attended migration connection.
   Verify SERVICE-only RLS and the restricted runtime role against the exact target.
3. Put scoped R2 credentials into the owner-only local runtime file, without logging them.
   Run `storage:initialize-trial` with the exact expected host/database/user/account/bucket
   assertions above. Two probes reserve Class A before network work. Require READY.
4. Only after action-time approval, transmit API-only runtime secrets to the intended Render API
   environment: restricted database URL, existing independent auth/edge/cron keys, scoped R2
   credentials, media signing material and the already selected mail/CAPTCHA/monitoring values.
   Never transmit the migration owner URL or AI keys. The web gets public settings only.
5. Verify actual HTTPS API origin; set its `/v1/storage/media/public` gateway base and exact web
   origin CORS. Bucket origins stay absent from browser CSP. Check upload/session/origin gates,
   then deploy the web with the matching public API URL. No publication approval is implied.

### Finite media acceptance budget

Use synthetic images only, at most 64 KiB each, and an attended single pass:

- Initialization: two maxKeys=1 empty probes, already included in usage.
- Upload at most one avatar, one notebook image and one board image. Verify owner reads,
  public/private split, expiry, session revocation, no-store/no-referrer and one-wire accounting.
- Overall session maxima: **8 Class A, 20 Class B, 1 MiB payload transfer and 6 DELETE requests**,
  including initialization and cleanup. These are an acceptance cap, not an automatic retry budget.
  Stop on the first ambiguous/error result; inspect recorded reservations before another run.
- Verify cold wake/restart, real signup/refresh/reset and intended email/CAPTCHA delivery, privacy
  logs/Sentry, shared host usage and restore rehearsal. Separately confirm message recipients and
  finite mail/monitoring probes before sending them. No real student photos or public admission.

### Stop and rollback

On any mismatch, uncertainty, unexpected paid tier, access scope or allowance, stop the attended
work. Keep buckets private, admission closed and counters/objects/uncertain reservations intact.
Do not rerun old unguarded `storage:check` or direct migration helpers against trial buckets.
Rollback may use only an artifact preserving bounded enforcement and current schema. The older
1513a5bb artifact predates this boundary and is not a compatible storage rollback. A renamed
bucket or direct-mode selection is not a quota reset. If a compatible artifact is unavailable,
keep the service/admission closed and reconcile offline with recorded facts.
Restoring an older database must also keep admission/media closed: its READY row and lifetime
counters may predate subsequent object writes and provider charges. Preserve current evidence
and reconcile usage before reopening; never treat an old backup as a fresh allowance.

## Practical limits

The 1 GiB allowance counts media payload, not every HTTP header/control request, page/asset,
database request or unrelated service. It reduces photo traffic exposure but cannot guarantee
that the entire workspace remains below its shared quota. Render Hobby currently includes 5 GB;
without a payment method, exhausted bandwidth can suspend all Free services for the remainder
of the month. Keep shared usage visible and admission small.
[Render bandwidth](https://render.com/docs/outbound-bandwidth), [Free limitations](https://render.com/docs/free).

Application R2 bounds likewise do not cap unrelated Cloudflare account usage or replace
provider privacy/credential acceptance. No additional staging was created, and no live provider,
DNS, billing or credential transmission was performed during source implementation.
