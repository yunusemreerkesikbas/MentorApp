import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  CONFIG_CHANGED_EVENT,
  ConfigChanged,
} from "../../../common/config/config-registry.service";
import {
  MentorshipEventTopic,
  MentorshipLinkAccepted,
  MentorshipLinkEnded,
  MentorshipSeatKind,
} from "../../mentorship/domain/mentorship.constants";
import { SponsoredSeatService } from "./sponsored-seat.service";

/** The one config key this listener reacts to. Kept next to its handler, not in a shared map. */
const SPONSORSHIP_FLAG_KEY = "mentorship.seats.sponsorship_enabled";

/**
 * W8 seat events → W4 entitlement.
 *
 * Only the domain constants cross the boundary, never a service: `PaymentsModule` does not import
 * `MentorshipModule` and vice versa. Same shape as W5's `MentorshipEventsListener`, and it is what
 * keeps "who may follow whom" and "who may use the AI" two separate questions with two owners.
 *
 * Best-effort. The link is already committed when we get here, and a failure to attach premium
 * must not surface as an error to the student who just accepted an invitation.
 */
@Injectable()
export class SponsoredSeatListener {
  private readonly logger = new Logger(SponsoredSeatListener.name);

  constructor(private readonly seats: SponsoredSeatService) {}

  @OnEvent(MentorshipEventTopic.LINK_ACCEPTED)
  async onLinkAccepted(event: MentorshipLinkAccepted): Promise<void> {
    if (event.seatKind === MentorshipSeatKind.NONE) return;
    await this.seats.grant(event.studentId, event.linkId).catch((err: unknown) => {
      this.logger.error(`Sponsored seat grant failed for link ${event.linkId}`, err);
    });
  }

  /**
   * Either side ending the link ends the sponsorship. Deliberately symmetric with the data rule:
   * a coach who no longer follows a student stops seeing their numbers, and stops paying for
   * their AI in the same breath.
   */
  @OnEvent(MentorshipEventTopic.LINK_ENDED)
  async onLinkEnded(event: MentorshipLinkEnded): Promise<void> {
    await this.seats.revoke(event.linkId).catch((err: unknown) => {
      this.logger.error(`Sponsored seat revoke failed for link ${event.linkId}`, err);
    });
  }

  /**
   * The kill switch. `mentorship.seats.sponsorship_enabled` gated new grants from the start; here
   * it also ends the live ones, which is the difference between a gate and a brake — an operator
   * who flips it because premium is costing too much means "now", not "for the next student".
   *
   * Switching it back ON grants nothing back: seats are decided at accept time, and silently
   * re-opening premium for links whose owners had already lost it would be a change nobody asked
   * for. `mentorship.coach.free_seats` stays forward-only for the same reason.
   */
  @OnEvent(CONFIG_CHANGED_EVENT)
  async onConfigChanged(event: ConfigChanged): Promise<void> {
    if (event.key !== SPONSORSHIP_FLAG_KEY || event.after !== false) return;
    await this.seats.revokeAll().catch((err: unknown) => {
      this.logger.error("Sponsorship kill switch failed to end live seats", err);
    });
  }
}
