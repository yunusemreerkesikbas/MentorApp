import { subscriptionsControllerGetMine } from "@mentor/api-client";
import type { SubscriptionView } from "@mentor/types";

let inFlight: Promise<SubscriptionView | null> | null = null;

/** Dedupes parallel mounts (dashboard greeting + mood, analysis ghost, session). */
export function fetchSubscriptionView(): Promise<SubscriptionView | null> {
  inFlight ??= subscriptionsControllerGetMine()
    .then((raw) => raw as unknown as SubscriptionView)
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
