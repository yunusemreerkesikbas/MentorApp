# Landing asset performance, package A

Approved on 2026-11-09: preserve the existing landing composition and animations; reduce favicon transfer, improve public city-image freshness, and correct caching documentation. No hosting upgrade, new dependency, HTML caching, or feature-availability caching.

## Design

- Replace the raster-backed SVG tab icon with a 64x64 PNG of the same artwork. Keep the existing ICO fallback and Apple touch icon. Metadata must declare the actual dimensions. Guard the selected tab icon with a 10 KiB transfer-body budget.
- Give only the existing fourteen city AVIF/WebP assets an explicit four-hour browser and shared-cache lifetime. Preserve the four-hour browser lifetime observed in production. Keep stable filenames; replacement artwork can remain stale for up to four hours, so version its URL for immediate replacement. A CDN purge refreshes the edge but cannot clear browser caches. Do not use immutable for these files.
- HTML, RSC responses, auth, API data, other media, missing filenames and security headers retain their existing policies. The nonce-based CSP requires dynamic localized documents; explicit data-fetch caching is independent.

## Verification and measurement

Use browser/request checks for icon metadata, dimensions, byte budget, all fourteen city assets, unrelated/missing paths, and localized HTML no-store. Existing landing tests cover camera geometry, mobile image selection, reduced motion and no-JavaScript artwork. Compare the icon at its rendered tab size and repeat mobile measurements with the same browser/network/CPU settings. Record before/after values and uncertainty separately from production acceptance.

Production baseline: three runs per viewport, fresh browser contexts, browser cache disabled. Mobile: 390x844, 200000 bytes/s down, 93750 bytes/s up, 150 ms latency, CPU rate 4. Median transferred bytes 956950; LCP 2080 ms; load 4982.9 ms; CLS 0. The SVG favicon transferred 101116 bytes including resource-timing overhead. Mobile LCP selected the stars, not the completed city artwork. Desktop median LCP 796 ms. These are lab samples, not field INP or p75 data.

Cloudflare observations: hashed JavaScript HIT with one-year immutable caching; city-facade.avif repeatedly REVALIDATED with browser max-age=14400; HTML DYNAMIC/no-store. Dashboard rules and the active hosting plan are unverified. Real edge HIT behavior must be accepted after deployment; no live speed improvement is claimed from local tests.
