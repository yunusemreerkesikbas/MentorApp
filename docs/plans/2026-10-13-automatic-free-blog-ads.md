# Automatic Free blog ads

## Accepted product decision

Anonymous and Free readers receive the single blog-end ad automatically when the existing backend
policy permits it. Premium and STAFF remain ad-free. Advertising is not an optional visitor feature;
optional analytics continues to require its own explicit choice. The owner approved this revision
on 2026-10-13 after reviewing the distinction between ad delivery and data consent.

## Scope and implementation

1. Remove the independent advertising accept/reject UI, context, storage and loader guards.
2. Keep viewport deferral, backend country/content/entitlement checks, limited-only GPT,
   CHILD/TEEN privacy settings, single placement and account/subscription cancellation.
3. Replace TR/EN ad-permission copy with accurate automatic-delivery/data-processing disclosure.
4. Update browser regressions for automatic anonymous/Free ads, legacy values, separate analytics,
   Premium transitions, excluded visitors, no-fill/blocking and translated disclosure.
5. Run relevant unit/browser tests, touched-file lint and web type checks; record release limits.

The old storage value is ignored, not changed to accepted. No provider, schema, sponsor inventory,
sales infrastructure or production flag is introduced. Existing rewarded UI remains a voluntary
action and its production verification gate remains closed.

## Provider and release constraints

Google limited ads disable personalization but are not equivalent to no data processing.
Programmatic limited ads use invalid-traffic-only cookies/local storage controlled by the Ad Manager
network setting, not by an invented per-request visitor switch. Google does not require consent
for that use case, but leaves local compliance to the publisher. Before enabling production,
document the actual processing, appropriate Turkish legal basis and international-transfer setup.
If the selected processing requires consent, choose a reviewed serving alternative; this change
does not establish consent or authorize bypassing a required privacy control.

Sources: [Google limited ads](https://support.google.com/admanager/answer/9882911?hl=en),
[KVKK cookie decision](https://www.kvkk.gov.tr/Icerik/7595/2022-1358).

Live Google setup, site approval, inventory/demand, legal review and real impression/revenue evidence
remain outstanding. Ad blockers, provider failures and no-fill must never block reading.
