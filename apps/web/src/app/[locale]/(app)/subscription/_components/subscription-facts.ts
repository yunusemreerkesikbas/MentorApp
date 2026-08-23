import type { EntitlementDto, PlanDto, SubscriptionDto } from "@mentor/types";

export type SubscriptionFactId =
  | "price"
  | "billing"
  | "started"
  | "trial_ends"
  | "period_start"
  | "next_renewal"
  | "access_ends"
  | "renewal";

export interface SubscriptionFact {
  id: SubscriptionFactId;
  iso?: string;
  periodMonths?: number;
  priceMinor?: number;
  renewal?: "auto" | "stops";
}

function sameCalendarDay(left: string, right: string): boolean {
  return left.slice(0, 10) === right.slice(0, 10);
}

/**
 * Rows for the subscription definition list. Status lives in the hero chip —
 * this list only adds dated / priced facts the API actually has.
 */
export function listSubscriptionFacts(input: {
  entitlement: EntitlementDto | undefined;
  subscription: SubscriptionDto | null | undefined;
  plan: PlanDto | null;
}): SubscriptionFact[] {
  const { entitlement, subscription, plan } = input;
  const reason = entitlement?.reason ?? "NONE";
  const facts: SubscriptionFact[] = [];

  if (plan) {
    facts.push({ id: "price", priceMinor: plan.priceMinor });
    facts.push({ id: "billing", periodMonths: plan.periodMonths });
  }

  if (!subscription) return facts;

  facts.push({ id: "started", iso: subscription.startedAt });

  const trialIso = subscription.trialEndsAt;
  const showTrial = reason === "TRIALING" && trialIso != null;
  if (showTrial && trialIso) {
    facts.push({ id: "trial_ends", iso: trialIso });
  }

  const periodStart = subscription.currentPeriodStart;
  if (periodStart && !sameCalendarDay(periodStart, subscription.startedAt)) {
    facts.push({ id: "period_start", iso: periodStart });
  }

  const endsIso = entitlement?.validUntil ?? subscription.currentPeriodEnd;
  const endsAtCancel =
    subscription.cancelAtPeriodEnd ||
    reason === "CANCELED_PERIOD" ||
    reason === "GRACE";

  if (endsIso) {
    const duplicatesTrial =
      showTrial && trialIso != null && sameCalendarDay(endsIso, trialIso);
    if (!duplicatesTrial) {
      facts.push({
        id: endsAtCancel ? "access_ends" : "next_renewal",
        iso: endsIso,
      });
    }
  }

  if (reason !== "INCOMPLETE") {
    facts.push({
      id: "renewal",
      renewal: subscription.cancelAtPeriodEnd ? "stops" : "auto",
    });
  }

  return facts;
}

export type SubscriptionStatusCopyKey =
  | "reason_free"
  | "reason_active"
  | "reason_trialing"
  | "reason_grace"
  | "reason_canceled"
  | "reason_expired"
  | "reason_staff"
  | "reason_incomplete";

/** Hero shows at most one chip. Cancel is already in the facts list — no second badge. */
export function heroChipKey(
  reason: string | undefined,
  cancelAtPeriodEnd: boolean,
): SubscriptionStatusCopyKey | null {
  if (!reason || reason === "NONE") return null;
  if (cancelAtPeriodEnd || reason === "CANCELED_PERIOD") return null;
  return subscriptionStatusKey(reason);
}

export function subscriptionStatusKey(
  reason: string | undefined,
): SubscriptionStatusCopyKey {
  switch (reason) {
    case "TRIALING":
      return "reason_trialing";
    case "ACTIVE":
      return "reason_active";
    case "GRACE":
      return "reason_grace";
    case "CANCELED_PERIOD":
      return "reason_canceled";
    case "EXPIRED":
      return "reason_expired";
    case "STAFF":
      return "reason_staff";
    case "INCOMPLETE":
      return "reason_incomplete";
    default:
      return "reason_free";
  }
}
