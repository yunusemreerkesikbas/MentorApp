# `apps/mobile` — PuhuKoç Mobile App (Expo / React Native)

> **Canonical context:** [`../../AGENTS.md`](../../AGENTS.md) · [`../../DESIGN.md`](../../DESIGN.md) · [`../../docs/standards/mobile.md`](../../docs/standards/mobile.md)

## Architecture & Shared Core

- **Framework:** Expo SDK 53 + React Native 0.79 + Expo Router (`src/app`, file-based routing).
- **Single API (`/v1`):** **Never** add Expo Router API routes (`+api.ts`). All data flows from the NestJS monolith via `@mentor/api-client`.
- **Shared Monorepo Packages:**
  - `@mentor/types` — 5-exam catalog (`KPSS · YKS · LGS · ALES · DGS`), DTOs, enums.
  - `@mentor/validation` — Shared Zod schemas (`loginSchema`, `signupSchema`, `updateMeSchema`, etc.).
  - `@mentor/core` — Exam-agnostic net formulas (`NET_PENALTY_DIVISOR`), Night Journey XP curve (`deriveLevel`), role-aware navigation (`getMobileTabItemsForRole`, `isStudentOnlyPath`, `homePathForUser`), feature gates (`blockedAppFeature`), and Turkish formatting (`dativeOf`, `genitiveOf`, `greetingKeyForHour`).
  - `@mentor/ui/tokens` — DOM-free `DESIGN.md` tokens (`lightThemeTokens`, `darkThemeTokens`, `sceneThemes`, `radii`, `touchTargets`, `ledgeTokens`, `typeScale`, `motionTokens`).
  - `@mentor/api-client` — Orval-generated `/v1` client configured with `clientPlatform: "mobile"`, sending `Accept-Language: tr | en` and `X-Client-Platform: mobile`.
- **Authentication & Security:**
  - Access token lives **in-memory only** (`AuthProvider`).
  - Refresh token is stored in hardware-backed **`expo-secure-store`** (iOS Keychain / Android EncryptedSharedPreferences) and rotated via `X-Refresh-Token` on `/v1/auth/refresh`.
- **State Management:**
  - Server state: **TanStack Query v5** (`QueryProvider` with `AppState` focus revalidation).
  - Client UI preferences: **Zustand** (`usePreferencesStore`).

## Commands

```bash
pnpm --filter @mentor/mobile dev        # Start Expo dev server
pnpm --filter @mentor/mobile ios        # Launch on iOS Simulator
pnpm --filter @mentor/mobile android    # Launch on Android Emulator
pnpm --filter @mentor/mobile typecheck  # TypeScript strict check
pnpm --filter @mentor/mobile lint       # ESLint check
pnpm --filter @mentor/mobile test       # Unit & voice parity tests
```
