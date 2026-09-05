import { Injectable, Logger } from "@nestjs/common";
import { COACH_SEAT_PLAN_ID, SUBSCRIPTION_PROVIDER_SPONSOR, SubscriptionStatus } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { SubscriptionsRepository } from "../infrastructure/payments.repositories";

/**
 * Coach-sponsored Premium (W8 seats).
 *
 * A sponsored seat is a REAL `subscriptions` row rather than a second entitlement source.
 * `EntitlementService.getEntitlement` runs on nearly every request; teaching it to join into the
 * coaching tables would poison the hot path for every user on the platform to serve a handful.
 * Writing the row instead means `computeEntitlement`, the expiry sweeper, the dunning grace and
 * every admin view keep working with no change at all.
 *
 * This service owns the money-shaped half of the seat. The seat DECISION belongs to W8, which
 * makes it under the accept transaction's lock and puts it on the event; the two modules never
 * import each other.
 */
/**
 * How many sponsored user ids one metrics call will gather. A ceiling, not a page size: past it
 * the reported cost undercounts, which the DTO flags rather than hides.
 */
export const SPONSORED_SEAT_METRIC_LIMIT = 1000;

/**
 * 30-day cohort cost per live seat, micro-USD.
 *
 * Null rather than 0 when there are no seats. Zero would read as "seats are free", which is the
 * opposite of what an empty cohort means, and it is the number an operator uses to decide whether
 * `mentorship.coach.free_seats` is set too high.
 */
export function costPerSeatMicros(costMicros30d: number, seats: number): number | null {
  if (seats <= 0) return null;
  return Math.round(costMicros30d / seats);
}

@Injectable()
export class SponsoredSeatService {
  private readonly logger = new Logger(SponsoredSeatService.name);

  constructor(
    private readonly subscriptions: SubscriptionsRepository,
    private readonly config: ConfigRegistryService,
  ) {}

  /**
   * Grant Premium to a student on a coach's seat.
   *
   * Returns false without writing when the student already holds an open subscription. That is
   * not just deference to their own purchase — the partial unique index allows one non-terminal
   * row per user, so an insert would fail anyway. Better to decide it here than to catch it there.
   *
   * `currentPeriodEnd` stays null on purpose: the ACTIVE branch of `computeEntitlement` skips the
   * expiry check when there is no end date (the shape STAFF already uses), so the seat needs no
   * monthly extension cron. It ends when {@link revoke} says it does.
   */
  async grant(studentId: string, linkId: string): Promise<boolean> {
    if (!(await this.config.get("mentorship.seats.sponsorship_enabled"))) return false;
    if (await this.subscriptions.findOpenForUser(studentId)) return false;

    await this.subscriptions.create({
      userId: studentId,
      planId: COACH_SEAT_PLAN_ID,
      status: SubscriptionStatus.ACTIVE,
      provider: SUBSCRIPTION_PROVIDER_SPONSOR,
      currentPeriodStart: new Date(),
      currentPeriodEnd: null,
      sponsorLinkId: linkId,
    });
    return true;
  }

  /**
   * End every live sponsorship — what flipping `mentorship.seats.sponsorship_enabled` off means.
   *
   * The flag was already a gate on new grants; making it retroactive is what turns it into a real
   * brake. `mentorship.coach.free_seats` deliberately does NOT behave this way: lowering a quota
   * should shape who gets a seat next, not take one back from somebody who already has it.
   */
  /** The user ids of live seats, for whoever can price them. Bounded; see the constant. */
  async listSeatUserIds(limit = SPONSORED_SEAT_METRIC_LIMIT): Promise<string[]> {
    return this.subscriptions.listSponsoredUserIds(limit);
  }

  /** How many seats are live. Counted, not inferred from the bounded id list above. */
  async countSeats(): Promise<number> {
    return this.subscriptions.countSponsoredSeats();
  }

  async revokeAll(now = new Date()): Promise<number> {
    const ended = await this.subscriptions.expireAllSponsored(now);
    if (ended > 0) this.logger.warn(`Sponsorship switched off — ended ${ended} seat(s)`);
    return ended;
  }

  /**
   * End the sponsorship attached to a link.
   *
   * No ledger row is written on either side of a seat's life: nothing was ever charged, so there
   * is nothing to reverse and nothing that belongs in an append-only record of money.
   */
  async revoke(linkId: string, now = new Date()): Promise<boolean> {
    const row = await this.subscriptions.findOpenBySponsorLink(linkId);
    if (!row) return false;
    await this.subscriptions.expireSponsorship(row.id, now);
    this.logger.log(`Sponsored seat ended for link ${linkId}`);
    return true;
  }
}
