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
      // Grace runs from the period end the failed renewal was meant to extend.
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
