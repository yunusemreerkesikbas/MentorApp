"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Which way the wizard is travelling: 1 forward, -1 back. Steps mount rather than cross-fade, so
 * this is the only thing that tells a screen whether it should arrive from the right or the left.
 */
const OnboardingDirectionContext = createContext<1 | -1>(1);

export function OnboardingDirectionProvider({ value, children }: { value: 1 | -1; children: ReactNode }) {
  return <OnboardingDirectionContext.Provider value={value}>{children}</OnboardingDirectionContext.Provider>;
}

export function useOnboardingDirection(): 1 | -1 {
  return useContext(OnboardingDirectionContext);
}
