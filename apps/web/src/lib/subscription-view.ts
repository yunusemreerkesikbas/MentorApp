import { subscriptionsControllerGetMine } from "@mentor/api-client";
import type { SubscriptionView } from "@mentor/types";

let inFlight: Promise<SubscriptionView | null> | null = null;

/** A hung entitlement read must not leave the panel hero on its skeleton. */
export const SUBSCRIPTION_VIEW_TIMEOUT_MS = 10_000;

/** Dedupes parallel mounts (dashboard greeting + mood, analysis ghost, session). */
export function fetchSubscriptionView(): Promise<SubscriptionView | null> {
  inFlight ??= (() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUBSCRIPTION_VIEW_TIMEOUT_MS);

    return subscriptionsControllerGetMine({ signal: controller.signal })
      .then((raw) => raw as unknown as SubscriptionView)
      .catch(() => null)
      .finally(() => {
        clearTimeout(timeout);
        inFlight = null;
      });
  })();
  return inFlight;
}
