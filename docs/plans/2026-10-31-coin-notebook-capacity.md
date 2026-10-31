# Permanent notebook capacity with Coin

Approved product decisions (2026-10-31):

- Free includes one custom notebook alongside the system Mistake Notebook.
- Each purchase adds permanent capacity for one custom notebook, initially 20 Coin.
- At most two extra slots per user by default. Both price and purchase cap are admin configurable.
- Deleting a notebook releases its occupied slot. Buying does not change page, entry, photo or AI entitlements.
- Disabling the economy stops offers and purchases; existing purchased capacity remains usable.

Implementation slices:

1. Add bounded, audited catalog settings and a shared purchase/view contract.
2. Count confirmed notebook purchase debits as durable capacity. Serialize cap checks, quote checks
   and the debit under the existing per-user economy transaction lock. Scope retry keys to the user.
3. Register capacity through coaching's entitlement seam, without reversing module dependencies.
4. Offer Coin capacity at the custom notebook limit. Display the live price, keep retries idempotent,
   refresh collection limits after success and preserve the Premium alternative.
5. Verify unit policy tests, real HTTP/Postgres purchase races, admin updates and mobile/desktop UI.

No schema migration or external fulfillment is needed: the immutable ledger purchase is the grant.
Lowering the sale cap never reduces ownership. An open quote must be reconfirmed after a price change.
