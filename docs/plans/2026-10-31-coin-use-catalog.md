# Coin use catalog

Approved scope: show the three existing Coin uses in the profile balance sheet, with live
server-derived price/eligibility, Premium inclusion and navigation to the owning feature. No new
purchase flow, earning rule, price, limit or Premium entitlement is introduced.

1. Add a self-scoped read contract and economy catalog endpoint. Economy composes notebook
   capacity with an AI-owned provider registered through a small resolver seam, avoiding a module
   cycle (AI already imports Economy). Use existing chat access and weekly-review/unlock services.
2. Render three accessible cards in the existing balance sheet, with current costs, owned slots,
   daily chat allowance, blocked states and an explicit non-spendable XP explanation. API errors
   cannot leave stale purchase promises visible; economy-off invalidates the shared snapshot.
3. Regenerate OpenAPI/client; verify focused service tests, real HTTP behavior and mobile/desktop
   UI including Premium, insufficient Coin, limits, disabled AI/economy and runtime refresh.

Catalog reads never debit Coin or call the LLM. The owning feature revalidates on entry/use. Already
owned weekly rights remain distinct from a new billable generation; access to cached reports is
not sold again. New per-feature purchase options remain a separate product discussion.
