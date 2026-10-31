# Deferred staging: archive and retained resources

Permanent staging is deferred. Production source preparation does not require a continuously
running second environment. This inventory does not authorize provisioning, DNS changes,
production secret reuse or Cloudflare overage terms.

## Owner scope reaffirmed (2026-10-31)

The owner declined extra staging cost or staging-specific development. The repository has
one CI workflow and no active automatic staging deployment. The selected first release uses
one Free core-trial environment; provider acceptance with synthetic data happens there before
user admission. Do not create a parallel hosted application or staging pipeline for this work.
The separate `puhu-core-trial` database prepared on 2026-10-30 belongs to that selected trial,
not to an additional staging release. This does not authorize public admission or paid usage.

The latest read-only Render dashboard check still showed zero services. Cloudflare's
2026-10-31 R2 view showed both retained `puhu-s1-*` EU buckets empty (0 objects / 0 B).
Management-only reads on 2026-10-31 report the old staging endpoint and the selected
core-trial endpoint both `idle`, each fixed at min=max 0.25 CU. The old staging endpoint's
last-active timestamp remains 2026-10-12. No SQL connection, wake-up, setting change or
resource creation was performed. Historical inventory below retains its original dates.
Preserve existing resources and secrets; no deletion or repurposing is requested.

## Recoverable work

- Commit `376a70e87d8db683be2b653d10c4789dcdf1d837` preserves previous staging Blueprints,
  operations scripts and indexing preparation in PR #156 history. No history was rewritten.
- Incomplete owned local changes were saved in the ignored, secret-free
  `.artifacts/deployment/staging-wip/staging-wip.patch`. No env file or credential is included.
  The patch remains local; preserve it separately before discarding this checkout.
- Current production source excludes staging Blueprints/bootstrap scripts/indexing branches
  and tests expecting unimplemented admin/migration modes. Historical definitions are not an
  approved runnable release. Review current terms, quotas, credentials and security before reuse.

## Retained inventory (2026-10-13)

| Resource | Recorded state | Follow-up |
|---|---|---|
| Neon `puhu-s1`, `nameless-surf-42172578` | Free; Frankfurt; PG16 | Preserve project |
| Branch `br-orange-truth-b9qhwncd` | `mentor`; pgvector; 126 existing migrations applied | Synthetic data only |
| Endpoint `ep-gentle-sky-b9gnp8lq` | Read-only check returned `idle`; min/max 0.25 CU; suspend timeout 0 | Keep idle |
| DB roles | `puhu_s1_migration` owner; `puhu_s1_runtime` restricted and verified | Never give owner URL to Free runtime |
| Bootstrap flags | `ai.enabled=false`, `dev.email.console_enabled=true` | Restrict email/reset-link logs |
| R2 `puhu-s1-public` / `puhu-s1-private` | Both EU buckets confirmed in dashboard; public: 0 objects / 0 B; private usage not reported | Preserve; no public-domain/token setup completed |
| Render | GitHub App linked only to MentorApp; no service/deploy created in this workflow | Preserve connection |
| Turnstile / Access | Turnstile drafted, not created; Access activation declined | No card overage authorization |

Suspend timeout is zero; the Free API rejected an override. Do not assume automatic suspension
or continuous availability. The latest endpoint read returned idle; no new DB connection was made.
Both stage buckets were confirmed in the Cloudflare dashboard without changing them.
Private usage was shown as unavailable, not zero. No resources were deleted by this cleanup.

Ignored `.env.staging` remains outside Git. It contains staging auth/edge/cron keys, restricted
and owner DB URLs, and the previously approved OpenAI credential. Do not copy these to production,
publish values or include the env file in a patch. Stage AI and real email delivery remain disabled.

## Optional temporary rehearsal

Consider an on-demand isolated environment for the first launch or critical auth, payments,
schema/storage/provider changes. Otherwise use local PostgreSQL and CI provider fixtures.
Before a rehearsal, agree its budget/expiry, use synthetic data and separate secrets, test the
exact release commit, and keep production security behavior. Do not restore incomplete tests as
if admin disabling or external migration modes existed. Record provider/browser evidence and
stop unused compute. Resource deletion and production publication are outside PR #156.
