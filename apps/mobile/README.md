# apps/mobile — B2C Student App (Phase 2)

> **Status:** Placeholder. MVP is responsive web-first; mobile = **#1 fast-follow / early Phase 2** (§10).

## Planned stack
- **Expo (React Native)** — the B2C student primary app (Pomodoro/push/realtime are mobile-native, §8).
- Shared: `@mentor/types`, `@mentor/validation`, `@mentor/api-client` (orval), design tokens from
  `@mentor/ui` (RN adaptation).
- Native push (Phase 2), OCR input (auto C/W/B), widget — §6/§10 backlog.

## ⚠️ Do NOT use Expo Router API routes
The single API = NestJS `/v1` (§8). Mobile gets all data via `@mentor/api-client` from NestJS.
Expo's API-routes feature becomes a second backend → breaks the single-API decision. The `expo-api-routes`
skill is only for EAS hosting/deploy.

## Why not now
The web-push + email bridge covers the lack of push in MVP (§10). Mobile comes online once the social
layer and user mass start to form.

Setup is not done in this phase; the skeleton only reserves the monorepo slot.
