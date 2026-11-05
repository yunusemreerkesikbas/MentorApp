# Premium Coach Chat Quota

The first release allows 20 model generations per rolling 24 hours and 100 per
rolling 30 days for each user with Premium chat entitlement. Admin can edit
`ai.chat.daily_limit` and `ai.chat.monthly_limit` in `/config`. Existing overrides
take precedence over catalog defaults. Both windows must have capacity.

Normal chat, streaming chat and regeneration share the quota. A chat request
that reaches provider dispatch consumes a slot even if the reply is interrupted.
Validation, global budget rejection and replies resolved locally before model
generation do not consume a slot. Separate AI features use their own policies.

The AI module uses the existing chat usage meter and a service-only table of
admitted attempts. A short Postgres transaction takes a per-user lock and checks
both windows before admitting the provider request. Settlement inserts usage and
removes the admission in the same transaction. Failed or interrupted attempts
age out of the rolling windows. Completed usage from before rollout participates
in both windows.

The existing access probe returns both remaining counts and, when blocked, the
earliest retry time allowed by both windows. Chat generation returns a localized
429 before the stream starts. Web preserves history and the draft. Verified
official-information and safety responses remain reachable through the composer.
