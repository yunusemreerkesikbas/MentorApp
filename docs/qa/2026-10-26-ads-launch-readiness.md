# Existing display inventory: setup and launch gates

## Current evidence (2026-10-26)

- Product is not launched. Repository deployment configuration targets `puhukoc.com`; this is
  configuration, not evidence of live DNS, hosting, ownership verification or Google approval.
- The owner-selected Google account showed **No AdSense account** in the browser. The signup
  form opened, but reCAPTCHA could not connect and the agreement checkbox remained disabled,
  including after one reload. No account, publisher ID, payment profile or accepted agreement
  was created. Do not record this attempt as an approved account or site.
- No real `GOOGLE_ADS_PUBLISHER_ID` was found in the checked local web environment files.
  The API's local blog inventory is configured, but a local/sample ad is not revenue evidence.
- All production activation and external approval gates below remain open. Do not expose real
  student accounts, private notebooks or private conversations to a crawler to complete setup.

## Account setup, in order

1. With the owner's explicitly selected account, open [AdSense](https://adsense.google.com/start/).
   First check for an existing account rather than creating a duplicate. Google permits account
   creation before a site is ready; choose **I don't have a site yet** while the product is unpublished.
   Confirm the real payment country with the owner: it cannot be changed after account creation.
   The owner must review the agreement; obtain action-time confirmation before accepting terms.
   A reCAPTCHA connectivity failure is a blocker, not a reason to bypass verification.
2. Complete Google's required account/payment/identity steps in the Google UI with the owner.
   Never place passwords, identity documents, payment details or authentication codes in this repo.
3. Use the same selected AdSense account to register [Ad Manager](https://admanager.google.com/).
   Google requires a valid AdSense account and permanently links the accounts. Confirm network
   time zone and currency before creating the first order, after which these settings are locked.
4. Deploy the owned HTTPS domain with accessible original editorial blog content and reviewed
   privacy/contact/legal pages. Complete the site verification/review appropriate to the actual
   Google account and demand source. Do not confuse Privacy & messaging status with AdSense
   approval; owned-and-operated and MCM site procedures differ.
5. Create real web DISPLAY ad units in Google inventory and connect actual demand. A unit path
   and an empty Ad Manager network do not establish fill or income. Keep Auto ads off so the
   app's one-slot-per-page rule remains intact. Do not inject a global verification/ad snippet
   into authenticated editors or workflows to satisfy a separate Google setup instruction.

## Connect the existing implementation

| Value | Where | Rule |
|---|---|---|
| Real Google seller ID, `pub-` plus 16 digits | Web runtime `GOOGLE_ADS_PUBLISHER_ID` (Render web env entry already exists) | Blank returns 404 from `/ads.txt`; never enter a fabricated ID |
| Owned HTTPS app URL | API `APP_URL`, web `NEXT_PUBLIC_SITE_URL`, DNS/Render custom domain | Match the actual deployment; a localhost readiness report describes local settings only |
| Actual `/network/unit` path | Existing admin `/config` → Reklamlar → each placement's `ad_unit_path` | Syntax is validated by shared Zod; unit ownership/demand still require Google verification |
| Legacy article fallback | API `GAM_KNOWLEDGE_ARTICLE_END_AD_UNIT` | Used only when article config is blank; other DISPLAY placements have no env fallback |
| Local sample preview | API `ADS_LOCAL_TEST_ENABLED` | Development/HTTP loopback only; never enable on staging/production |

The existing root `/ads.txt` publishes `google.com, <real seller ID>, DIRECT, f08c47fec0942fa0`.
Confirm the ID matches the actual DIRECT seller account. If Google supplies other required seller
records or a different commercial relationship, review the route instead of mislabeling it DIRECT.
Check `https://puhukoc.com/ads.txt` without a locale prefix, sign-in, Cloudflare challenge or redirect
to a login page, then verify Google's authorization status. Crawling updates can take time.

In existing admin `/config`, **Reklam yayınına hazırlık** reads the current API process configuration
through `GET /v1/admin/ads/readiness` (SUPER_ADMIN only). It shows eight DISPLAY placements,
switches, missing/sample/configured unit status and unit source, country allowlist and local test
mode. Refresh explicitly or save an existing setting. It does not contact Google, inspect student
data, read private content or change settings; a failed read removes the previous report.
An empty issue list means only that those configuration blockers are absent. It never certifies
Google approval, fresh editorial approval, ads.txt, legal review, crawlability or user eligibility.

Official sample DISPLAY network `6355419` is rejected by runtime when `NODE_ENV` or `APP_ENV`
is production, even if pasted into the registry or legacy env with preview mode disabled.
The placement reports `TEST_INVENTORY_NOT_ALLOWED` and no unit path. Rewarded production
server-verification restrictions and the Coin flow remain unchanged.

## Per-placement release gates

| Placement | Additional evidence before enabling |
|---|---|
| `knowledge.article.end` | Published original article, verified exam context; recommended first pilot |
| `knowledge.index` | Adequate published editorial descriptions on the actual family/category/page |
| `forum.question.end` | Answered public QA and current editor-approved publisher revision |
| `community.question.end` | Separate current community snapshot approval, safe authenticated-page eligibility/crawling |
| `community.announcement.end` | Existing PUBLIC active ANNOUNCEMENT content with approved current snapshot; no default room exists |
| `community.overview` | Independent `review_approved` and Google/content review of the actual eligible view |
| `notebooks.overview` | Google acceptance and safe content/crawling evidence for a signed-in private entry screen |
| `vision.overview` | Same authenticated-page gate; closed mobile discovery panel never initializes the ad |

Country/exam/CHILD/TEEN treatment, Premium/STAFF ad-free access, reviewed-view proof, responsive
size filtering, lazy loading, no-fill collapse and session/subscription teardown remain runtime
checks. Never relax them to make a setup screenshot display an ad. Notebook/board editors,
coaching and focus screens remain outside DISPLAY inventory. Public/settings TR/EN disclosure
covers the gated screens, independent analytics choice and limited-ad processing; copy changes
alone do not establish lawful processing. Review the real Programmatic limited ads setting,
invalid-traffic storage, foreign transfer, applicable consent/CMP requirements and minors policy
before activating. If the processing requires consent, the current automatic model needs a
separately reviewed solution before activation.

## Controlled pilot and rollback

- Before merge/release, complete full CI and verify existing review migrations `0130`/`0131`
  are deployed. This preparation adds no database migration. Run staging smoke with isolated
  fixtures, real API/country-edge behavior, supported sizes, no-fill/provider failures and
  subscription changes. Test ads are not approval, fill or income evidence.
- Only after all external gates pass, configure the article's real unit and independently enable
  the article pilot with the existing global/display/placement switches. Keep the seven other
  DISPLAY placements and all rewarded production delivery closed pending their own gates.
- Config changes apply to the next eligibility read. The registry cache is process-local: with
  multiple API replicas, coordinate invalidation/restarts or keep one instance during the pilot.
  No config polling or live invalidation of already open pages has been added.
- For 14 days starting at the first **real** impression, use Google Ad Manager fill, viewability
  and revenue reports; watch existing error/performance/user feedback channels. Do not create
  user-level ad tracking tables. Stop for policy issues, incorrect age treatment, editor ad
  requests, privacy exposure, blocked writing/saving/map use or material regressions.
- Roll back by disabling the affected placement, or `ads.enabled` for all ads, in audited admin
  settings. Verify a fresh eligibility request is denied across API instances; reload any test
  page. Existing open pages do not receive a live setting broadcast. Disable the corresponding
  Google inventory/line item too if immediate provider-side stopping is necessary.

## Primary sources checked

- [AdSense account creation, including unpublished sites](https://support.google.com/adsense/answer/7402253?hl=en)
- [Ad Manager registration and account linking](https://support.google.com/admanager/answer/7084151?hl=en)
- [Account-specific site setup and approval statuses](https://support.google.com/admanager/answer/10130765?hl=en)
- [Root-domain ads.txt requirements](https://support.google.com/admanager/answer/9422161?hl=en)
- [Create and verify ads.txt seller records](https://support.google.com/admanager/answer/9422067?hl=en)
- [Limited ads and invalid-traffic storage](https://support.google.com/admanager/answer/9882911?hl=en)
