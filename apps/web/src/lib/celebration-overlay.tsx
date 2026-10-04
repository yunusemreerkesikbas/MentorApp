"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

type CelebrationOverlayValue = {
  /** Unseen achievement / journey celebrations have been fetched at least once. */
  ready: boolean;
  /** The celebration queue currently has a full-screen occupant. */
  active: boolean;
};

const CelebrationOverlayContext = createContext<CelebrationOverlayValue | null>(
  null,
);

const IDLE: CelebrationOverlayValue = { ready: true, active: false };

export function CelebrationOverlayProvider({
  ready,
  active,
  children,
}: CelebrationOverlayValue & { children: ReactNode }) {
  const value = useMemo(() => ({ ready, active }), [ready, active]);
  return (
    <CelebrationOverlayContext.Provider value={value}>
      {children}
    </CelebrationOverlayContext.Provider>
  );
}

/** Missing provider → do not hold the caller (tests, surfaces without the app celebration queue). */
export function useCelebrationOverlay(): CelebrationOverlayValue {
  return useContext(CelebrationOverlayContext) ?? IDLE;
}
