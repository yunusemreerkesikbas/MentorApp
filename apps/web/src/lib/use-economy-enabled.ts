"use client";

import { useAppAvailability } from "./app-availability";
import { useEconomySnapshot } from "./economy-store";

/** Availability gates first paint; a closed API response also invalidates an existing document. */
export function useEconomyEnabled(): boolean {
  const availability = useAppAvailability();
  const snapshot = useEconomySnapshot();
  return availability?.economy === true && snapshot.enabled !== false;
}
