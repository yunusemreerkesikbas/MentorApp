# Marketing integration verification

Verified on 17–18 November 2026 (Europe/Istanbul) through the owner's Chrome session and Metricool MCP.

## Provider state

| Service | Observed result |
| --- | --- |
| Google Search Console URL property | `https://puhukoc.com/` revalidated automatically with the existing HTML meta tag under `puhukoc@gmail.com`. The property was originally added on 10 November. |
| Google Search Console domain property | Added the missing root TXT record in Cloudflare, then observed Google's automatic ownership verification and opened the domain property successfully. |
| Sitemap | Both property views show `https://puhukoc.com/sitemap.xml`, successful, last read 16 November, 15 discovered pages. No duplicate submission was needed. |
| Search Console–GA4 association | Existing association confirmed: URL-prefix property, PuhuKoç Web stream `16310560629`, created by `puhukoc@gmail.com` on 11 November. |
| GA4 | Property `563539205`, measurement ID `G-1D83FS710H`. Correct tag present on the live site after consent, but GA4 reports no data in the previous 48 hours; Tag Assistant detects the tag with no hits. Collection is **not verified working**. |
| Enrich Labs Search Console | Owner approved `webmasters.readonly`; OAuth succeeded. Both properties are discovered; the verified URL property was selected and confirmed. |
| Enrich Labs GA4 | Owner separately approved `analytics.readonly`; the integration shows Connected, one property, `puhukoc.com`, linking to property `563539205`. |
| Metricool | MCP and Connections page agree: brand `puhukoc`, ID `7993018`, owner `puhukoc@gmail.com`, timezone `Europe/Istanbul`; Facebook PuhuKoç, professional Instagram `puhukoc`, personal TikTok `puhukoc` connected. |
| Meta portfolio | Portfolio `1474142841585669` accessible as Puhu Koc with full control. Facebook page asset ID shown by Meta and Metricool is `1396869360184232`; the owner's supplied `61596535977277` does not match this current asset ID. No asset was replaced. |
| Personal Meta invitation | `yunusemreyee64@gmail.com` is listed with full access but status **Invited**, no activity. Puhu Koc and Instagram puhukoc are active. The owner must accept using the invited identity. No new invitation was sent. |
| Render | `puhu-pilot-web`, service `srv-dbnfgrp5efls73b6t2cg`, live and deployed from `master`; current live commit `0f0cb0ba6aa5063673e3b9e078ee6391fde55df8`. Production DNS points to this service. No deployment was triggered. |

Cloudflare root TXT, TTL Auto (keep this record):

```text
google-site-verification=1FB-5830feik7AHk8KoiWqkd4rPdhqNIFNh3fYaDgqE
```

## GA4 correction prepared locally

The consent initializer and event fallback passed plain arrays into `dataLayer`. Google's command protocol uses an `Arguments` object; arrays represent data-layer method calls instead. Both call sites now use `queueGoogleTagCommand`. Existing consent gates and allowlisted payloads remain intact.

Reference: [Google data-layer documentation](https://developers.google.com/tag-platform/tag-manager/datalayer).

Files:

- `apps/web/src/lib/analytics.ts`
- `apps/web/src/lib/analytics-consent.tsx`
- `apps/web/src/lib/analytics.spec.ts`
- `apps/web/src/lib/analysis-analytics.spec.ts`
- `apps/web/e2e/analytics-consent.spec.ts`
- `docs/features/web-shell.md`

Validation:

- Regression first failed: queued command was `[object Array]`, expected `[object Arguments]`.
- Focused Vitest suites: **12 passed**.
- Targeted ESLint for the five touched code/test files: passed.
- Chrome consent browser tests against the local development server: **2 passed** (no Google script before consent/after refusal; single script and provider-compatible configuration/events after acceptance). Vendor script is stubbed in these tests.
- App TypeScript check initially failed because the existing `apps/web/test-results/seo-upload-458b17f7/` scratch source tree was included. A separate compiler invocation excluding generated `test-results` inputs reported **0 diagnostics**; the tracked config was not changed.
- Full CI, production build and post-deployment GA4 receipt were not run. This patch is not a production release.

## Remaining completion checks

1. Release only the GA4 correction through the repository's normal review/CI flow. There are unrelated pre-existing edits in the current working tree; do not publish them as part of this setup.
2. Run full CI for the exact release tree, deploy the reviewed commit, accept analytics in a fresh live browser session, and verify a received `page_view` in Tag Assistant and GA4 Realtime. Tag detection alone is insufficient. Check refusal still suppresses collection.
3. Confirm the invited personal identity becomes active in Meta after the owner accepts the email invitation.

No paid plans, ads, new tracking vendors, account transfers, credential changes, or social posts were created. Instagram/TikTok registration emails were not established by these connection checks.

Screenshots are in `artifacts/marketing-setup/`: `domain-verified.jpg`, `domain-sitemap.jpg`, `cloudflare-txt.jpg`, `enrich-search-console.jpg`, `enrich-ga4.jpg`, `meta-access.jpg`.

## Follow-up: infrastructure accounts and advertising (18 November)

- **Render account:** current account menu shows `20060364@stu.omu.edu.tr`, GitHub login `yunusemreerkesikbas`. Opened the profile email edit control for the requested change to `puhukoc@gmail.com`. Entry, save and any verification were handed to the owner because this changes account identity/recovery information. Do not record the change as completed until the updated address is visible.
- **Neon:** MCP access confirmed for organization `Yunus Emre` (`org-silent-credit-71124687`, Free). `puhu-core-trial` (`falling-bar-88067595`) main branch is ready, its compute active in Frankfurt, PostgreSQL 16, 0.25 CU. A read-only SQL check succeeded: `neondb`, 125 public tables, `puhu_trial_runtime.rolbypassrls=false`. This is not a comprehensive RLS/restore audit or an end-to-end production application test. Older project `puhu-s1` also exists; it was not altered.
- **Resend:** current browser session requires login. The production `puhu-pilot-api` Environment page contains masked `RESEND_API_KEY` and `RESEND_FROM` entries; no value was revealed. Historical evidence in `2026-10-28-free-first-launch.md` records `puhukoc.com` Verified, a sending-only domain-scoped key and one inbox-confirmed Gmail test. Current domain status, account identity and delivery remain pending the owner's login. No new email was sent.
- **AdSense:** Google's account page explicitly reports no AdSense account for `puhukoc@gmail.com`.
- **Google Ads:** Google's account selection explicitly reports no Google Ads account for `puhukoc@gmail.com`.
- **Meta Ads:** portfolio `1474142841585669` Ad Accounts page says no advertising account has been added. Existing Facebook/Instagram connections are not evidence of a configured advertising account.
- **Google Ad Manager:** selecting the PuhuKoç Google account returns the marketing/start page; no active inventory/network dashboard was verified. Do not claim a network exists or is approved.
- **Publisher authorization:** live `https://puhukoc.com/ads.txt` returns `Not configured`.

No advertising account, campaign, paid plan, payment profile or additional credentials were created during this check. Production settings were not changed. Render email and Resend access were left at the owner-input stage.

### Owner follow-up

The owner deferred the Render email change; leave the existing account unchanged. Resend's current authenticated dashboard remains required before reporting its domain or delivery status as current. AdSense setup is waiting for the owner's payment country and individual/business selection. Google's official documentation confirms that the payment-address country cannot be changed and the account type cannot be changed after activation; Ad Manager requires a valid AdSense account first. No country, payee or account type was assumed.

References: [AdSense payment address](https://support.google.com/adsense/answer/2628816), [account type](https://support.google.com/adsense/answer/10163?hl=en), [Ad Manager signup](https://support.google.com/admanager/answer/7084151?hl=en).

The owner subsequently selected **Turkey / individual** for AdSense, deferred the Resend check, and requested continuing with AdSense. Opened the existing AdSense signup flow; Google account selection requires the owner to choose `puhukoc@gmail.com` in the current native-control session. No signup agreement was accepted and no account was created at this stage.
