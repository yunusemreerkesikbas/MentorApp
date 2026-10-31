"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AppAvailabilityDto } from "@mentor/types";

const AvailabilityContext = createContext<AppAvailabilityDto | null | undefined>(undefined);

export function AppAvailabilityProvider({ availability, children }: { availability: AppAvailabilityDto | null; children: ReactNode }) {
  return <AvailabilityContext.Provider value={availability}>{children}</AvailabilityContext.Provider>;
}

export function useAppAvailability(): AppAvailabilityDto | null {
  const value = useContext(AvailabilityContext);
  if (value === undefined) throw new Error("useAppAvailability must be used within AppAvailabilityProvider");
  return value;
}

/** Closed children do not mount, so their effects cannot request a disabled feature. */
export function AvailableFeature({ feature, children }: { feature: keyof AppAvailabilityDto; children: ReactNode }) {
  return useAppAvailability()?.[feature] ? children : null;
}
