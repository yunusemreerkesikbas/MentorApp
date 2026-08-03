# YKS 3D Campus + Preference Simulation

> Status: implemented behind `coaching.preference_simulation.enabled`; rollout is intentionally
> closed until the official YKS dataset and verified Selçuk campus coordinates are available.

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

## 3D adapter and fallbacks

The simulation-only client chunk loads `@googlemaps/js-api-loader` v2 and the `maps3d` library.
`Map3DElement`, `flyCameraTo`, and keyboard-accessible interactive markers provide the tour;
Three.js and custom 3D assets are not used. Reduced-motion users receive direct camera updates.

Fallback order is editorial coverage preference (`PHOTOREALISTIC` or `HYBRID`), then the existing
2D Turkey map if the key, WebGL, Maps API, or campus endpoint is unavailable. The preferences and
insights panel remains usable when the map fails.

## Rollout checklist

1. Import the final—not preliminary—official YKS guide with its exact source URL, verification time,
   and official preference limit.
2. Use a browser-restricted Google key to verify Selçuk coverage. Store `PHOTOREALISTIC` when the
   mesh is available; otherwise store `TERRAIN_ONLY` + `HYBRID`.
3. Editorially verify exact coordinates and official source URLs for these five stops, in order:
   Alaeddin Keykubat campus main entrance; Prof. Dr. Erol Güngör Library; Sultan Alparslan Cultural
   Center; Faculty of Engineering; Faculty of Economics and Administrative Sciences.
4. Enable the campus row only after all five POIs are verified. Do not insert guessed coordinates.
5. Configure HTTP referrer restrictions, API quotas, and a Cloud Billing budget alert; run desktop
   and mobile smoke tests with the real key.
6. Enable `coaching.preference_simulation.enabled` for internal smoke, then for all YKS beta users.

No analytics or Sentry payload from this feature contains ranks, program codes, or other PII.

## Geliştirmeler (timeline)

- **2026-08-02 — Selçuk pilot foundation and complete preference draft flow:** added versioned
  official catalog metadata, editorial campus/POI data, personal revisioned scenarios, backend-only
  rank comparisons, stale refresh, forced RLS, API contracts/OpenAPI client, localized responsive
  web route, accessible guided 3D adapter, 2D fallback, autosave, keyboard reorder, and explicit
  “set as Vision Board goal” action. Gotcha: the flag remains off because this workspace has no
  Google key, no final active official dataset, and no verified POI coordinates. Related files:
  migration `0072_fancy_arclight.sql`, `preference-simulation.service.ts`,
  `preference-catalog.service.ts`, `simulation-shell.tsx`, and
  `preference-simulation.spec.ts`.
