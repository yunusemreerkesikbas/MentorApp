# YKS 3D Campus + Preference Simulation

> Status: implemented but intentionally disabled with
> `coaching.preference_simulation.enabled = false`. The Selçuk prototype and official YKS dataset
> remain available for future research, but the feature will not be exposed while Google provides
> no verified Photorealistic 3D surface coverage for a Turkish university.

## Product boundary

The simulation combines a five-stop, bird's-eye campus tour with one server-saved YKS preference
draft. It shows only the numerical difference between the user's rank and the last official
placement rank. It does not calculate probability, label a preference as safe/risky/guaranteed,
or call an LLM.

The pilot route is `/tr/hedef/simulasyon` (`/en/vision-board/simulation`). `/hedef` remains the
fast static 2D experience and does not download Google Maps code. A Selçuk CTA appears only when
the runtime flag, the active official dataset, and an enabled campus experience are all present.

## Architecture and data

- Content owns global editorial data: `program_catalog_datasets`, `campus_experiences`, and
  `campus_pois`. Program search is bound to the active dataset's guide/placement years.
- Coaching owns personal data: one `preference_scenarios` row per user and ordered snapshot rows in
  `preference_scenario_items`. Both tables use forced RLS plus explicit repository user filters.
- `PUT` is a full-draft, optimistic-concurrency write. A stale `expectedRevision` returns
  `409 SCENARIO_REVISION_CONFLICT`.
- Old dataset drafts stay readable and are read-only. `refresh` carries forward programs still in
  the active catalog and reports removed program codes.
- Account erasure deletes the scenario; item rows cascade. The rollback smoke test at
  `apps/api/test/preference-simulation-rls.sql` verifies cross-user reads/writes, cross-scenario
  child inserts, and account-deletion cascade with a non-superuser database role.

## API

- `GET /v1/content/programs/search`
- `GET /v1/content/universities/:id/campus-experience`
- `GET /v1/coaching/preference-simulation/access`
- `GET|PUT|DELETE /v1/coaching/preference-simulation`
- `POST /v1/coaching/preference-simulation/refresh`

The active dataset contains the official preference limit and exact official source card. There is
no code fallback for the limit. Dataset activation by `seed:programs` requires all three one-shot
inputs: `YKS_OFFICIAL_PREFERENCE_LIMIT`, `YKS_PROGRAM_DATASET_SOURCE_URL`, and
`YKS_PROGRAM_DATASET_VERIFIED_AT`.

## 3D overview, Street View walk mode, and fallbacks

The simulation-only client chunk loads `@googlemaps/js-api-loader` v2 and the `maps3d` library.
`Map3DElement`, `flyCameraTo`, and keyboard-accessible interactive markers provide the tour;
Three.js and custom 3D assets are not used. Stop presets keep a 650-metre minimum range so the
campus remains legible instead of dropping the camera onto blurry roof imagery. Reduced-motion
users receive direct camera updates.

The selected stop is also checked against Google Street View at runtime. When nearby outdoor
imagery exists, the `Kuşbakışı / Yürüyüş` control can open a standalone panorama over the still
mounted 3D overview. The panorama is constructed only after the user enters walk mode and the same
instance is reused for later stops during that route visit. Panorama IDs are session-unstable and
are therefore never persisted; each lookup starts from the editorial POI coordinates. A lightweight
back-facing SVG student avatar reflects arrival, movement, and idle states without intercepting
Street View controls. Reduced-motion users receive a static avatar.

Fallback order is editorial coverage preference (`PHOTOREALISTIC` or `HYBRID`), then the existing
2D Turkey map if the key, WebGL, Maps API, or campus endpoint is unavailable. The preferences and
insights panel remains usable when the map fails. Missing Street View coverage is stop-local: it
disables only walk mode and leaves the aerial tour available. Street View panorama construction is
billable under Google Maps Platform, so the preflight uses `StreetViewService` and no panorama is
created until the user explicitly requests it.

## Rollout checklist

1. Import the final—not preliminary—official YKS guide with its exact source URL, verification time,
   and official preference limit.
2. Use a browser-restricted Google key to verify Selçuk coverage. Store `PHOTOREALISTIC` when the
   mesh is available; otherwise store `TERRAIN_ONLY` + `HYBRID`.
3. Editorially verify exact coordinates and official source URLs for these five stops, in order:
   Alaeddin Keykubat campus main entrance; Prof. Dr. Erol Güngör Library; Sultan Alparslan Cultural
   Center; Faculty of Technology; Faculty of Economics and Administrative Sciences. Selçuk's former
   Faculty of Engineering moved to Konya Technical University in 2018, so the current Selçuk stop
   uses the Faculty of Technology, which hosts its engineering programs.
4. Enable the campus row only after all five POIs are verified. Do not insert guessed coordinates.
5. Configure HTTP referrer restrictions, API quotas, and a Cloud Billing budget alert; run desktop
   and mobile smoke tests with the real key.
6. Enable `coaching.preference_simulation.enabled` for internal smoke, then for all YKS beta users.

No analytics or Sentry payload from this feature contains ranks, program codes, or other PII.

## Geliştirmeler (timeline)

- **2026-08-08 — Türkiye Photorealistic 3D kapsamı nedeniyle rollout durduruldu:** gerçek Google
  anahtarıyla yapılan Selçuk smoke testinde yalnız terrain/uydu görünümü elde edildi. Google'ın
  güncel coverage sözleşmesine göre bina ve ağaç yüzey mesh'i dünya genelinde değil, yalnız
  işaretli bölgelerde sunuluyor; Türkiye'de doğrulanmış bir üniversite bulunamadığı için runtime
  flag yeniden kapatıldı. Prototip kodu ve verisi, Google kapsamı değişirse tekrar değerlendirilmek
  üzere korundu. Gotcha: `SATELLITE` moda geçmek etiketleri kaldırır ancak eksik yüzey mesh'ini
  oluşturmaz. Related config: `coaching.preference_simulation.enabled = false`.

- **2026-08-08 — 3D durak geçişlerinde arazi irtifası düzeltmesi:** kampüs kamera
  preset'leri artık `flyCameraTo` içinde `RELATIVE_TO_GROUND` olarak yorumlanıyor. Böylece Selçuk
  gibi deniz seviyesinden yüksek kampüslerde `altitude: 0`, deniz seviyesini hedefleyip kamerayı
  araziye gömmüyor. Aynı seçenek ilk açılışta, animasyonlu durak geçişinde ve azaltılmış hareket
  modundaki ani geçişte kullanılıyor. Gotcha: POI kamera irtifaları zemine göre ofsettir; mutlak
  rakım olarak kaydedilmemelidir. Related files: `campus-camera.ts`, `campus-camera.spec.ts`, and
  `campus-3d-map.tsx`.

- **2026-08-08 — Selçuk hover-card simulation entry:** exposed the verified Selçuk simulation
  directly from the desktop university hover card without requiring the university to be saved as
  the user's target first. The page preflights the pilot campus endpoint once after access and geo
  data resolve; hovering itself makes no request and loads no Google bundle. The card uses separate
  sibling controls for details and simulation navigation, avoiding nested interactive elements.
  Mobile keeps the existing tap-to-details flow because it has no hover interaction. Related files:
  `university-hover-card.tsx`, `vision-board-shell.tsx`, and `vision-board.spec.ts`.

- **2026-08-08 — Hybrid campus walk and student avatar:** added runtime Street View coverage checks,
  an accessible `Kuşbakışı / Yürüyüş` mode switch, one reusable panorama per route visit, and a
  reduced-motion-aware 2.5D student avatar driven by panorama movement events. Selçuk stop cameras
  now retain 650–800 metres of range for a clearer campus overview. Usage: select a verified stop;
  when the status says the walk view is ready, choose `Yürüyüş`, use Google's arrows to move, and
  return with `Kuşbakışı`. Gotchas: coverage differs per stop, panorama IDs must not be persisted,
  and entering walk mode creates a billable Street View view. Related files: `campus-street-view.tsx`,
  `campus-walk-avatar.tsx`, `campus-walk-state.ts`, `google-maps-loader.ts`, and
  `seed-selcuk-campus.mjs`.

- **2026-08-08 — Local Selçuk pilot activated for real-key testing:** imported and activated the
  final 2026 ÖSYM program catalog (21,493 programs) with the official 24-preference limit, then
  added a repeatable Selçuk campus seed with five ordered POIs, official source links, camera
  presets, and conservative `TERRAIN_ONLY` + `HYBRID` coverage until the real-key visual check is
  complete. Running `node apps/api/scripts/seed-selcuk-campus.mjs` is idempotent; use
  `--validate-only` to verify the fixture without touching the database. The obsolete Engineering
  Faculty stop was corrected to the current Faculty of Technology. Gotcha: the runtime flag and a
  YKS user profile are still required for the CTA. Related files: `seed-selcuk-campus.mjs` and
  `selcuk-campus-seed.spec.ts`.

- **2026-08-02 — Selçuk pilot foundation and complete preference draft flow:** added versioned
  official catalog metadata, editorial campus/POI data, personal revisioned scenarios, backend-only
  rank comparisons, stale refresh, forced RLS, API contracts/OpenAPI client, localized responsive
  web route, accessible guided 3D adapter, 2D fallback, autosave, keyboard reorder, and explicit
  “set as Vision Board goal” action. Gotcha: the flag remains off because this workspace has no
  Google key, no final active official dataset, and no verified POI coordinates. Related files:
  migration `0072_fancy_arclight.sql`, `preference-simulation.service.ts`,
  `preference-catalog.service.ts`, `simulation-shell.tsx`, and
  `preference-simulation.spec.ts`.
