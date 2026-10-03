import { Inject, Injectable, Logger } from "@nestjs/common";
import { COACH_SEAT_PLAN_ID, SUBSCRIPTION_PROVIDER_SPONSOR, SubscriptionStatus } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { SubscriptionsRepository } from "../infrastructure/payments.repositories";
import { UsersService } from "../../identity/application/users.service";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";

type SeatEligibilityCheck = (
  studentId: string, linkId: string, coachId: string, tx: DatabaseTx,
) => Promise<boolean>;

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
 * makes it under the accept transaction's lock and registers the exact-link check used at grant.
 * Payments never imports MentorshipModule or reads its tables.
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
  private eligibilityCheck?: SeatEligibilityCheck;

  constructor(
    private readonly subscriptions: SubscriptionsRepository,
    private readonly config: ConfigRegistryService,
    private readonly users: UsersService,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  /** W8 owns the relationship check; payments never reads mentorship tables. */
  registerEligibilityCheck(check: SeatEligibilityCheck): void {
    this.eligibilityCheck = check;
  }

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
  async grant(studentId: string, linkId: string, coachId: string): Promise<boolean> {
    if (!(await this.config.get("mentorship.seats.sponsorship_enabled"))) return false;
    const eligible = this.eligibilityCheck;
    if (!eligible) return false;
    return withServiceContext(this.db, async (tx) => {
      // Stable identity locks first, then relationship, then subscription. Paid/trial checkout
      // locks the same student's identity row, so purchase and sponsorship cannot both reserve it.
      for (const id of [...new Set([studentId, coachId])].sort()) {
        if (!(await this.users.lockActiveAccount(id, tx))) return false;
      }
      if (!(await this.users.isPhoneVerified(studentId, tx)) ||
          !(await this.users.isPhoneVerified(coachId, tx))) return false;
      if (!(await this.users.isEmailVerified(coachId, tx))) return false;
      // Holds the exact ACTIVE seated link through insert: a delayed grant after END fails closed.
      if (!(await eligible(studentId, linkId, coachId, tx))) return false;
      if (await this.subscriptions.findOpenForUser(studentId, tx)) return false;
      await this.subscriptions.create({
        userId: studentId,
        planId: COACH_SEAT_PLAN_ID,
        status: SubscriptionStatus.ACTIVE,
        provider: SUBSCRIPTION_PROVIDER_SPONSOR,
        currentPeriodStart: new Date(),
        currentPeriodEnd: null,
        sponsorLinkId: linkId,
      }, tx);
      return true;
    });
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
