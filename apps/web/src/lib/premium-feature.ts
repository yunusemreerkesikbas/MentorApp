import type { PremiumFeatureId, SubscriptionView } from "@mentor/types";

export function isPremiumFeatureAvailable(
  view: SubscriptionView | null | undefined,
  featureId: PremiumFeatureId,
): boolean {
  if (!view) return false;
  if (view.entitlement.isPremium) return true;
  return Boolean(view.features?.[featureId]?.freeEnabled);
}
