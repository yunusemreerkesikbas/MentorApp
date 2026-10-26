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
 * Whole percent a multi-month plan saves against paying the monthly plan for the same months, on
 * list prices. Rounded down so the badge never claims more than the prices give. Undefined when
 * there is no monthly plan to compare with or nothing is saved.
 */
export function savingsPercent(
  plan: { periodMonths: number; priceMinor: number },
  plans: readonly { periodMonths: number; priceMinor: number }[],
): number | undefined {
  const monthly = plans.find((candidate) => candidate.periodMonths === 1);
  if (!monthly || plan.periodMonths <= 1) return undefined;
  const fullMinor = monthly.priceMinor * plan.periodMonths;
  const percent = Math.floor(((fullMinor - plan.priceMinor) * 100) / fullMinor);
  return percent > 0 ? percent : undefined;
}

/**
 * Display only: what a multi-month price comes to per month, so two plans compare in one unit.
 * The charged total stays on the card and in the consent line; nothing is billed from this figure.
 */
export function monthlyEquivalentMinor(priceMinor: number, periodMonths: number): number {
  return Math.round(priceMinor / Math.max(1, periodMonths));
}
