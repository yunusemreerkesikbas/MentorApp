import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { MentorshipErasureService } from "./application/mentorship-erasure.service";
import { MentorshipInviteService } from "./application/mentorship-invite.service";
import { MentorshipLinkService } from "./application/mentorship-link.service";
import { MentorshipInviteCodeRepository } from "./infrastructure/mentorship-invite-code.repository";
import { MentorshipLinkRepository } from "./infrastructure/mentorship-link.repository";
import { MentorshipCoachController } from "./presentation/mentorship-coach.controller";
import { MentorshipStudentController } from "./presentation/mentorship-student.controller";

/**
 * W8 - mentorship: the human coach relation (roadmap §9 BYOS).
 *
 * Depends on identity only, for the display-identity seam. It never reads another module's tables;
 * coaching data reaches the coach through coaching's own exported aggregate services (next slice).
 * `MentorshipLinkService` is exported so those services can reuse the single authorization gate.
 */
@Module({
  imports: [IdentityModule],
  controllers: [MentorshipCoachController, MentorshipStudentController],
  providers: [
    MentorshipLinkService,
    MentorshipInviteService,
    MentorshipErasureService,
    MentorshipLinkRepository,
    MentorshipInviteCodeRepository,
  ],
  exports: [MentorshipLinkService, MentorshipErasureService],
})
export class MentorshipModule {}
