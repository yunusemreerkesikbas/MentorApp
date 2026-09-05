import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  MentorshipEventTopic,
  MentorshipLinkAccepted,
  MentorshipLinkEnded,
  MentorshipSeatKind,
} from "../../mentorship/domain/mentorship.constants";
import { SponsoredSeatService } from "./sponsored-seat.service";

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
}
