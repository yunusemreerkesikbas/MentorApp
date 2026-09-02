import { Module } from "@nestjs/common";
import { CoachingModule } from "../coaching/coaching.module";
import { IdentityModule } from "../identity/identity.module";
import { MentorshipErasureService } from "./application/mentorship-erasure.service";
import { MentorshipAssignmentService } from "./application/mentorship-assignment.service";
import { MentorshipInviteService } from "./application/mentorship-invite.service";
import { MentorshipLinkService } from "./application/mentorship-link.service";
import { MentorshipRosterService } from "./application/mentorship-roster.service";
import { MentorshipInviteCodeRepository } from "./infrastructure/mentorship-invite-code.repository";
import { MentorshipLinkRepository } from "./infrastructure/mentorship-link.repository";
import { MentorshipCoachController } from "./presentation/mentorship-coach.controller";
import { MentorshipStudentController } from "./presentation/mentorship-student.controller";

/**
 * W8 - mentorship: the human coach relation (roadmap §9 BYOS).
 *
 * Depends on identity (display-identity seam) and coaching (the exported `CohortEvidenceService`
 * aggregate boundary). It never reads another module's tables.
 * `MentorshipLinkService` is exported so other services can reuse the single authorization gate.
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
    MentorshipLinkRepository,
    MentorshipInviteCodeRepository,
  ],
  exports: [MentorshipLinkService, MentorshipErasureService],
})
export class MentorshipModule {}
