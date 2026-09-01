import { Injectable } from "@nestjs/common";
import { SubscriptionStatus, SubscriptionTier, UserRole, type EntitlementDto } from "@mentor/types";
import { UsersRepository } from "../../identity/infrastructure/users.repository";
import { GRACE_PERIOD_DAYS } from "../domain/payments.constants";
import { SubscriptionsRepository, type SubscriptionRow } from "../infrastructure/payments.repositories";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The single source of "is this user premium?" — consumed by W3 (ai gate) and W6 (admin).
 * Pure state-machine read; all date math is server-side (engineering-principles §4).
 *
 * PREMIUM ⇐ STAFF role (team/beta — no subscription row, stats stay clean) ·
 *           TRIALING (until trialEndsAt) · ACTIVE (until periodEnd) ·
 *           PAST_DUE within grace (§7 dunning) · CANCELED until periodEnd.
 */
@Injectable()
export class EntitlementService {
  constructor(
    private readonly subscriptions: SubscriptionsRepository,
    private readonly users: UsersRepository,
  ) {}

  /**
   * @param rolesHint roles already at hand (e.g. from the verified JWT) — skips a user
   *   lookup. Without a hint the roles are fetched (server-side callers, W3 context builder).
   */
  async getEntitlement(userId: string, rolesHint?: string[]): Promise<EntitlementDto> {
    const roles = rolesHint ?? (await this.users.findByIdService(userId))?.roles ?? [];
    if (roles.includes(UserRole.STAFF)) {
      return {
        tier: SubscriptionTier.PREMIUM,
        isPremium: true,
        validUntil: null, // role-bound: lasts until the role is removed (W6 manages roles)
        reason: "STAFF",
      };
    }
    const sub = await this.subscriptions.findOpenForUser(userId);
    return computeEntitlement(sub ?? null, new Date());
  }
}

/**
 * Did this user have premium and lose it? The WIN_BACK signal.
 *
 * Delegates to {@link computeEntitlement} so it can never disagree with what the user is shown.
 * INCOMPLETE is excluded: it grants no premium, but that user is mid-checkout and has lost
 * nothing — there is nothing to win back.
 */
export function hasLostAccess(sub: SubscriptionRow | null, now: Date): boolean {
  if (!sub || sub.status === SubscriptionStatus.INCOMPLETE) return false;
  return !computeEntitlement(sub, now).isPremium;
}

/**
 * May the sweeper retire this row?
 *
 * A NARROWER question than {@link hasLostAccess}: an already-EXPIRED row is terminal, so it is not
 * sweepable — even though its owner has very much lost access. Keeping the two apart is what makes
 * the sweep idempotent without also blinding the win-back rule.
 */
export function hasRunOut(sub: SubscriptionRow, now: Date): boolean {
  if (sub.status === SubscriptionStatus.EXPIRED) return false;
  return hasLostAccess(sub, now);
}

/** Exported pure function — unit-testable without DB. */
export function computeEntitlement(sub: SubscriptionRow | null, now: Date): EntitlementDto {
  const free = (reason: string): EntitlementDto => ({
    tier: SubscriptionTier.FREE,
    isPremium: false,
    validUntil: null,
    reason,
  });
  const premium = (reason: string, until: Date | null): EntitlementDto => ({
    tier: SubscriptionTier.PREMIUM,
    isPremium: true,
    validUntil: until?.toISOString() ?? null,
    reason,
  });

  if (!sub) return free("NONE");

  switch (sub.status) {
    // Checkout started but the provider hasn't confirmed payment — the verification gate withholds
    // premium until the checkout-completed webhook activates the row (an abandoned page grants nothing).
    case SubscriptionStatus.INCOMPLETE:
      return free("INCOMPLETE");
    case SubscriptionStatus.TRIALING: {
      const until = sub.trialEndsAt ?? sub.currentPeriodEnd;
      if (until && until.getTime() <= now.getTime()) return free("EXPIRED");
      return premium("TRIALING", until);
    }
    case SubscriptionStatus.ACTIVE: {
      const until = sub.currentPeriodEnd;
      if (until && until.getTime() <= now.getTime()) return free("EXPIRED");
      return premium("ACTIVE", until);
    }
    case SubscriptionStatus.PAST_DUE: {
      // Grace runs from the period end the failed renewal was meant to extend. PAST_DUE
      // normally always has currentPeriodEnd; `?? updatedAt` is an explicit safety net for a
      // malformed row (still bounded — never an unbounded grace), not a silent fallback.
      const base = sub.currentPeriodEnd ?? sub.updatedAt;
      const graceUntil = new Date(base.getTime() + GRACE_PERIOD_DAYS * DAY_MS);
      if (graceUntil.getTime() <= now.getTime()) return free("EXPIRED");
      return premium("GRACE", graceUntil);
    }
    case SubscriptionStatus.CANCELED: {
      const until = sub.currentPeriodEnd;
      if (!until || until.getTime() <= now.getTime()) return free("EXPIRED");
      return premium("CANCELED_PERIOD", until);
    }
    default:
      return free("EXPIRED");
  }
}
