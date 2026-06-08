# Mobile Standards (Expo / React Native — Phase 2)

> **Status:** Mobile is Phase 2 (placeholder). The standard is fixed now so we're aligned when we start.
> Canonical context: [`../../AGENTS.md`](../../AGENTS.md) · Reference skills: `expo`, `building-native-ui`, `expo-tailwind-setup`.

## Architecture
- [ ] **Expo Router (file-based).** ⚠️ **Do NOT use API routes** — single API = NestJS `/v1` (§8). A second
  backend breaks the single-API decision.
- [ ] Data from the **single API**: `@mentor/api-client`. Types & validation: `@mentor/types` +
  `@mentor/validation` (shared with web).
- [ ] **No business logic/calculations on mobile** (§principles) — backend computes, mobile shapes/displays.
  **User-facing messages come localized from the backend** and are shown directly (same contract as web).
- [ ] Design: an **RN adaptation** of `@mentor/ui` tokens (same color/spacing/radius source; no magic numbers).

## Platform & UX
- [ ] Respect platform conventions (iOS/Android navigation, back behavior, safe-area).
- [ ] Touch targets ≥44px; gestures/animations native-feeling (Reanimated); haptics in moderation.
- [ ] Long lists virtualized (FlashList/FlatList); heavy work off the main thread.
- [ ] **Latency tolerance:** optimistic UI for latency-tolerant work; queue while offline, send on reconnect.

## Versioning & release
- [ ] Mobile **can't be force-updated** → API `/v1` must be backward-compatible; the client tolerates old versions.
- [ ] Native push in Phase 2 (web bridges with web-push + email). Fast patches via OTA/EAS Update; store
  release for breaking changes.
- [ ] Build/release via **EAS**; pipeline with `expo-cicd-workflows`.

## Don't
- ❌ Expo Router API routes (backend) · ❌ copying types/schemas between web and mobile · ❌ off-DESIGN values ·
  ❌ synchronous heavy work.
