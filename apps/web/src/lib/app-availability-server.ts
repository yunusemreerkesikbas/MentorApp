import { APP_AVAILABILITY_KEYS, type AppAvailabilityDto } from "@mentor/types";
import { apiBaseUrl } from "./api-base";

const AVAILABILITY_FETCH_TIMEOUT_MS = 3_000;

/** Fresh document snapshot. Null is an explicit unavailable state, never an enabled default. */
export async function fetchAppAvailability(): Promise<AppAvailabilityDto | null> {
  try {
    const response = await fetch(`${apiBaseUrl()}/v1/app/availability`, {
      cache: "no-store", signal: AbortSignal.timeout(AVAILABILITY_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !APP_AVAILABILITY_KEYS.every(key => typeof (body as Record<string, unknown>)[key] === "boolean")) {
      throw new Error("Invalid availability response");
    }
    return Object.fromEntries(APP_AVAILABILITY_KEYS.map(key => [key, (body as AppAvailabilityDto)[key]])) as AppAvailabilityDto;
  } catch {
    console.warn("App availability snapshot unavailable");
    return null;
  }
}
