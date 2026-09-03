import { Module } from "@nestjs/common";
import { CoachingModule } from "../coaching/coaching.module";
import { IdentityModule } from "../identity/identity.module";
import { MentorshipErasureService } from "./application/mentorship-erasure.service";
import { MentorshipAssignmentService } from "./application/mentorship-assignment.service";
import { MentorshipInviteService } from "./application/mentorship-invite.service";
import { MentorshipLinkService } from "./application/mentorship-link.service";
import { MentorshipRosterService } from "./application/mentorship-roster.service";
import { PlanTaskFeedbackListener } from "./application/plan-task-feedback.listener";
import { MentorshipInviteCodeRepository } from "./infrastructure/mentorship-invite-code.repository";
import { MentorshipLinkRepository } from "./infrastructure/mentorship-link.repository";
import { MentorshipQueryAdapter } from "./infrastructure/mentorship-query.adapter";
import { MENTORSHIP_QUERY_PORT } from "./domain/mentorship-query.port";
import { MentorshipCoachController } from "./presentation/mentorship-coach.controller";
import { MentorshipStudentController } from "./presentation/mentorship-student.controller";

/**
 * W8 - mentorship: the human coach relation (roadmap §9 BYOS).
 *
 * Depends on identity (display-identity seam) and coaching (the exported `CohortEvidenceService`
 * aggregate boundary). It never reads another module's tables.
 * `MentorshipLinkService` is exported so other services can reuse the single authorization gate;
 * `MENTORSHIP_QUERY_PORT` is the read seam notifications uses for the daily risk digest, so risk
 * evaluation stays here and W5 never learns what a flag means.
 */
@Module({
  imports: [IdentityModule, CoachingModule],
  controllers: [MentorshipCoachController, MentorshipStudentController],
  providers: [
    MentorshipLinkService,
    MentorshipInviteService,
    MentorshipRosterService,
    MentorshipAssignmentService,
    MentorshipErasureService,
    PlanTaskFeedbackListener,
    MentorshipLinkRepository,
    MentorshipInviteCodeRepository,
    MentorshipQueryAdapter,
    { provide: MENTORSHIP_QUERY_PORT, useExisting: MentorshipQueryAdapter },
  ],
  exports: [MentorshipLinkService, MentorshipErasureService, MENTORSHIP_QUERY_PORT],
})
export class MentorshipModule {}
