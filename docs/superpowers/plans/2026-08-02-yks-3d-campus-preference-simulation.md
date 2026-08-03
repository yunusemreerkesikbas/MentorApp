# YKS 3D Campus + Preference Scenario Implementation Plan

> Approved product decision: 2026-08-02. This plan is implemented with TDD and targeted verification.

## Product boundary

- Keep `/vision-board` (`/hedef`) as the fast 2D goal screen and add the nested
  `/vision-board/simulation` (`/hedef/simulasyon`) experience.
- Pilot the guided campus experience at Selçuk University with five editorially verified POIs.
- Prefer Google Photorealistic 3D where coverage exists and keep the same tour on hybrid terrain where it does not.
- Let YKS users build one persisted ordered draft from all active official YKS programs.
- Compare the user's optional SAY/EA/SÖZ/DİL/TYT ranks with the matching historical placement rank.
- Never produce probability, eligibility, safe/risky/guaranteed labels, or LLM-generated placement facts.
- Keep exploration independent from the Vision Board target; only an explicit action can change the target.
- Ship the free YKS beta behind a runtime flag.

## Delivery sequence

1. Record the roadmap exception and verify the Selçuk coverage/render mode with a restricted Google Maps key.
2. Add content-owned dataset metadata, campus experience/POI data, active-catalog program search, and public APIs.
3. Add coaching-owned scenario persistence, immutable program snapshots, deterministic comparison, revision conflicts,
   stale-data refresh, RLS, and erasure coverage.
4. Add the localized simulation route, lazy Google Maps 3D adapter, guided tour, responsive insights/preferences panel,
   autosave, and 2D failure fallback.
5. Export OpenAPI, regenerate the API client, update feature/service documentation, and run proportional verification.

## API contract

- `GET /v1/content/programs/search`
- `GET /v1/content/universities/:id/campus-experience`
- `GET /v1/coaching/preference-simulation/access`
- `GET /v1/coaching/preference-simulation`
- `PUT /v1/coaching/preference-simulation`
- `POST /v1/coaching/preference-simulation/refresh`
- `DELETE /v1/coaching/preference-simulation`

The save contract carries `datasetVersion`, `expectedRevision`, optional ranks, and unique ordered program codes.
The read contract carries the active official dataset, one scenario, server-computed comparisons, stale state, and the
refresh impact. Missing verified dataset metadata disables the feature; no preference-limit fallback is hardcoded.

## Acceptance gates

- Selçuk coverage is explicitly recorded as `PHOTOREALISTIC` or `TERRAIN_ONLY`; `UNKNOWN` cannot be enabled.
- Official POIs have coordinates, source URL, localized content, and a verification timestamp.
- Comparison, validation, stale refresh, conflict, ownership/RLS, and erasure behaviors have automated coverage.
- Google Maps code is absent from the `/hedef` initial bundle and loads only inside the simulation client boundary.
- Tour controls are keyboard accessible and respect reduced motion; map failure leaves insights/preferences usable.
- Analytics and error reporting contain no exact rank, program code, or PII.
- The feature remains flag-gated and paywall-free for the YKS beta.
