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
