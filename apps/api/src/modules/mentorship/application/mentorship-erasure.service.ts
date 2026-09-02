import { Injectable } from "@nestjs/common";
import { PlanService } from "../../coaching/application/plan.service";
import { MentorshipInviteCodeRepository } from "../infrastructure/mentorship-invite-code.repository";
import { MentorshipLinkRepository } from "../infrastructure/mentorship-link.repository";

/**
 * KVKK erasure for W8 (called by AccountErasureService).
 *
 * Links are DELETED, not anonymized: a coach-student relation is a fact about two people, and
 * keeping a dangling half after one of them exercises erasure serves nobody. The counterpart simply
 * loses the link, exactly as if it had been ended.
 *
 * Deleting them is not enough on its own. `plan_tasks.origin_ref_id` is a soft ref with no FK, so
 * an erased coach would leave their students holding tasks badged "from your coach" that the API
 * refuses to let them edit, pointing at a link row that no longer exists. The tasks stay (they are
 * the student's work), but the provenance goes with the coach.
 */
@Injectable()
export class MentorshipErasureService {
  constructor(
    private readonly links: MentorshipLinkRepository,
    private readonly codes: MentorshipInviteCodeRepository,
    private readonly plan: PlanService,
  ) {}

  async eraseUserData(userId: string): Promise<void> {
    const purgedLinkIds = await this.links.purgeForUser(userId);
    await this.plan.clearMentorshipOrigin(purgedLinkIds);
    await this.codes.purgeForCoach(userId);
  }
}
