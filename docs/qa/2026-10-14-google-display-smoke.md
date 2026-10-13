# Google display smoke: 2026-10-14

## Scope

Actual Google limited GPT and official test inventory were exercised in fresh headless Chrome
contexts against an isolated copy of the web source. The original developer web/API servers were
not restarted. Synthetic article content ran on localhost:3301, the isolated web on localhost:3108.
Browser placement responses supplied a synthetic eligible policy; no database configuration,
country guard, production env file or ad enable flag was changed. Optional analytics was rejected.

This is a real Google SDK/creative rehearsal with a simulated backend, not an end-to-end
production country/entitlement test or publisher revenue proof.

## Findings and repairs

- Google's limited tag returned HTTP 200. The outbound request used `ltd=1` and the official
  `/6355419/Travel/Europe/France/Paris` sample unit, decoded from the SDK's batched request.
- The initial 320x100 sample request returned `slotRenderEnded.isEmpty=true`. Google's documented
  300x250 size returned `isEmpty=false` and a visible Chrome-browser sample creative.
- Added 300x250 to the existing article inventory; kept 320x100/728x90 and width filtering.
  Both lazy boundary and rendered slot reserve 250px for the largest declared inventory.
- Real traffic-quality resources exposed three CSP violations: ep1 configuration fetch, ep1 pixel
  and ep2 frame. Only ep1 was added to connection/image directives and ep2 to the frame directive.
  No wildcard, script-origin allowance, production eval or disabled CSP was introduced.
- After the repair, desktop/mobile each received one non-empty 300x250 render and one creative
  iframe. Cropped screenshots visually confirmed the Google test image and the ad label. Final
  live runs had no observed CSP violation. Anonymous refresh 401, a GPT in-viewport warning and
  requests cancelled at teardown are expected rehearsal diagnostics, not a zero-console claim.

## Evidence

Validation after the repairs: 25 web security/GPT unit tests, 31 API ads unit tests and all 26
stubbed mobile/desktop blog-ad cases passed. Web/API package typechecks, changed-file lint and
diff whitespace checks passed. The first isolated browser run had analytics disabled, so its
analytics-banner case could not run; a dummy measurement ID plus a stubbed analytics provider
made that scenario available without sending real analytics. Full hosted CI/production build
and live publisher-revenue validation remain separate release requirements.

Local ignored artifacts are under `.artifacts/deployment/real-google-smoke/`:
`desktop.json`, `mobile.json`, `desktop-ad.png`, `mobile-ad.png` and full-page screenshots.
Query data was limited to inventory/size/privacy fields; console URL queries were stripped in
the final reports. No ad was clicked. The sample creative is Google-hosted; it was not replaced
with a local image or fake GPT response.

## Repeat and release

1. Keep test/production inventory separate; use the official sample only in an isolated rehearsal.
2. Verify published article and backend eligibility with the existing API tests. For actual
   country coverage use a trusted test edge; do not loosen production header/authentication guards.
3. Open the article anonymously or as Free and approach its end. Verify the limited script,
   a supported request size, non-empty render and the actual creative's paint.
4. Verify Premium/STAFF make no new requests, account/subscription transitions remove slots,
   and no-fill/blocking leaves reading available. Keep deterministic stubbed tests in normal CI.
5. Before real earnings, complete publisher/site approval, correct ads.txt, real demand/inventory,
   category/child protection and legal/transfer review, exact-commit CI and the restricted
   production impression/reporting checks. Production ad flags stay off until those gates pass.

References: [Google test ad](https://developers.google.com/publisher-tag/samples/display-test-ad),
[supported sizes](https://developers.google.com/publisher-tag/guides/ad-sizes),
[strict CSP](https://developers.google.com/publisher-tag/guides/content-security-policy).
