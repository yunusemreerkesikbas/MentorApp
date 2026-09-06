import { Injectable } from "@nestjs/common";
import { PlanService } from "../../coaching/application/plan.service";
import { MentorshipApplicationRepository } from "../infrastructure/mentorship-application.repository";
import { MentorshipCohortBriefRepository } from "../infrastructure/mentorship-cohort-brief.repository";
import { MentorshipInviteCodeRepository } from "../infrastructure/mentorship-invite-code.repository";
import { MentorshipLinkRepository } from "../infrastructure/mentorship-link.repository";
import { MentorshipTemplateRepository } from "../infrastructure/mentorship-template.repository";

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
 *
 * `mentorship_dropped_assignments` needs no clause here: its `link_id` is a real FK with
 * ON DELETE CASCADE onto `coach_students`, so purging the links takes the drop log with them.
 * That is only true because links are deleted rather than anonymized — if that ever changes, the
 * log has to be purged explicitly.
 *
 * `mentorship_program_templates` DOES need a clause, even though its `coach_id` is a real FK with
 * ON DELETE CASCADE: erasure anonymizes the `users` row instead of deleting it, so that cascade
 * never fires. A template holds the coach's own words about nobody in particular, but it is still
 * their content, and content survives the person who wrote it only by accident.
 *
 * `mentorship_coach_applications` needs one for the identical reason, and more urgently: an
 * application is the person's own account of who they are — an institution, a branch, years of
 * work — sitting next to an admin's verdict on it. That is the last thing that should outlive the
 * account by way of a cascade that never fires.
 *
 * `mentorship_cohort_briefs` is the third, and the one worth pausing on: unlike the per-student
 * brief — which lives on the link row and is therefore deleted for free — a cohort brief is the
 * COACH's row, holding LLM-written sentences about students. Erasing the coach must take it; and
 * erasing a *student* is covered from the other side, because the brief stores ids rather than
 * names and every read resolves the name live through the anonymized `users` row.
 */
@Injectable()
export class MentorshipErasureService {
  constructor(
    private readonly links: MentorshipLinkRepository,
    private readonly codes: MentorshipInviteCodeRepository,
    private readonly templates: MentorshipTemplateRepository,
    private readonly applications: MentorshipApplicationRepository,
    private readonly cohortBriefs: MentorshipCohortBriefRepository,
    private readonly plan: PlanService,
  ) {}

  async eraseUserData(userId: string): Promise<void> {
    const purgedLinkIds = await this.links.purgeForUser(userId);
    await this.plan.clearMentorshipOrigin(purgedLinkIds);
    await this.codes.purgeForCoach(userId);
    await this.templates.purgeForCoach(userId);
    await this.applications.purgeForUser(userId);
    await this.cohortBriefs.purgeForCoach(userId);
  }
}
