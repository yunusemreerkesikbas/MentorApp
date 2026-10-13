interface PaywallPlan {
  id: string;
  periodMonths: number;
}

/**
 * The plan the paywall recommends and opens on: the longest period, when there is a choice.
 * A single-plan catalog has nothing to recommend.
 */
export function featuredPlanId(plans: readonly PaywallPlan[]): string | undefined {
  if (plans.length < 2) return undefined;
  const longest = plans.reduce((best, plan) => (plan.periodMonths > best.periodMonths ? plan : best));
  return longest.periodMonths > 1 ? longest.id : undefined;
}

/**
 * Display only: what a multi-month price comes to per month, so two plans compare in one unit.
 * The charged total stays on the card and in the consent line; nothing is billed from this figure.
 */
export function monthlyEquivalentMinor(priceMinor: number, periodMonths: number): number {
  return Math.round(priceMinor / Math.max(1, periodMonths));
}
