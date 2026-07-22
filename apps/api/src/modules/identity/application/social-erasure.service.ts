import { Injectable, Logger } from "@nestjs/common";
import { BuddyRepository } from "../infrastructure/buddy.repository";
import { FollowRepository } from "../infrastructure/follow.repository";

/**
 * KVKK erasure for the social graph (WP-K): follows (both directions) and buddy pairs are
 * relational PII — who studies with whom — so they are hard-deleted. Idempotent (deletes are no-ops
 * on a second run). Lives in identity because that module owns `user_follows` and `buddy_pairs`.
 */
@Injectable()
export class SocialErasureService {
  private readonly logger = new Logger(SocialErasureService.name);

  constructor(
    private readonly follows: FollowRepository,
    private readonly buddies: BuddyRepository,
  ) {}

  async eraseUserData(userId: string): Promise<void> {
    await this.follows.deleteAllForUser(userId);
    await this.buddies.deleteAllForUser(userId);
    this.logger.log(`Social graph erased for user ${userId}`);
  }
}
