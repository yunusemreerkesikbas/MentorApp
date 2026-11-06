import type { EconomyBalance } from "@mentor/types";

export const EMPTY_ECONOMY_BALANCE: EconomyBalance = {
  xp: 0,
  coinConfirmed: 0,
  coinPending: 0,
  level: {
    tier: 1,
    xp: 0,
    nextAt: 1000,
    key: "spark",
    chapter: "awakening",
    currentAt: 0,
    nextKey: "trail",
    progress: { current: 0, target: 1000, remaining: 1000, percent: 0 },
  },
};
