# Earned plan previews and paid-surface corrections

Approved scope: fix daily-greeting rereads and the shared photo quota, then add an explicit Coin
path to the plan-page wizard. Product decision: 20 Coin per new successful preview, at most one
per rolling 24 hours; price and cap are centrally admin configurable. No Coin path is added to
daily greetings, mood/session adaptation or the legacy plan-draft endpoint.

## Corrections

- A daily greeting is already-owned content for its user, UTC date and locale. Read the stored
  greeting before checking the generation allowance. Global AI-off still blocks the surface.
  A different locale/day without a stored greeting must pass the normal generation gate.
- Photo quota counts successful `vision` AI usage, which both notebook and mock-exam paths meter.
  Classification result rows are labels, not request usage: they omit notebook calls and empty
  classifications. No migration/reset of the existing AI usage history is needed.

## Coin preview

- Preserve Premium/capped-taste routes. A feature-owned offer decides included access versus Coin,
  price, rolling limit, balance, global AI/budget and rollout availability. UI and Coin catalog use
  that decision. The new rollout flag defaults off; only disposable QA settings are changed here.
- Opening the wizard or reading its evidence is free. Final generation requires explicit price
  confirmation. A changed quote is rejected before generating. Only `source: PLAN` is accepted.
- Persist a user-scoped idempotent generation record before the model call. Serialize only the
  short claim/settlement transactions, never hold a database transaction across the provider.
  Pending attempts reserve the rolling allowance; expired claims can be abandoned without debit.
- Persist a valid result before the Coin debit. Then atomically debit via Economy's public
  caller-owned transaction interface and mark the preview ready. A failed provider/parser never
  debits. If another purchase uses the balance during generation, keep the generated result locked
  and allow the same request to finish payment later without another model call. Its confirmed
  price remains fixed. A model-produced `NO_CHANGE` response costs zero.
- Replays bind request ID, user, input and locale. Completed requests return their stored result;
  concurrent in-progress requests return a localized retry message. Failed requests do not rerun
  implicitly. New requests cannot bypass either Coin or existing generation caps.
- Owned paid previews remain readable when economy/rollout is off. Applying uses existing coaching
  validation, including stale-plan rejection, and never spends again. Regeneration is a new quoted
  request. Hiding the waiting view does not cancel the server request; the saved preview can be
  reopened. The UI explains this before confirming.
- Keep AI preview data in AI-owned storage, service RLS plus explicit user predicates, and include
  it in KVKK erasure. Ledger rows remain append-only. No raw user notes in ledger metadata.

## Verification

Failing unit regressions precede the two corrections. Use dedicated disposable Postgres databases
for quota integration, idempotency, concurrent claims, stale prices, insufficient balance, provider
failure, switches, ownership and budget cases. In mobile/desktop browsers earn 20 Coin, generate
and reopen/apply a plan, check one debit, and verify dynamic admin settings. No real paid model,
payment or email provider is called. Update AI/economy docs and the API catalog; run targeted tests,
types/lint and review the final diff. Full workspace CI remains a merge/release gate.
