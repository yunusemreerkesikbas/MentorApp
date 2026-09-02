import { Injectable } from "@nestjs/common";
import { MentorshipInviteCodeRepository } from "../infrastructure/mentorship-invite-code.repository";
import { MentorshipLinkRepository } from "../infrastructure/mentorship-link.repository";

/**
 * KVKK erasure for W8 (called by AccountErasureService).
 *
 * Links are DELETED, not anonymized: a coach-student relation is a fact about two people, and
 * keeping a dangling half after one of them exercises erasure serves nobody. The counterpart simply
 * loses the link, exactly as if it had been ended.
 */
@Injectable()
export class MentorshipErasureService {
  constructor(
    private readonly links: MentorshipLinkRepository,
    private readonly codes: MentorshipInviteCodeRepository,
  ) {}

  async eraseUserData(userId: string): Promise<void> {
    await this.links.purgeForUser(userId);
    await this.codes.purgeForCoach(userId);
  }
}
