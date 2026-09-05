import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { CoachingModule } from "../coaching/coaching.module";
import { PaymentsModule } from "../payments/payments.module";
import { IdentityModule } from "../identity/identity.module";
import { MentorshipErasureService } from "./application/mentorship-erasure.service";
import { MentorshipAssignmentService } from "./application/mentorship-assignment.service";
import { MentorshipInviteService } from "./application/mentorship-invite.service";
import { MentorshipLinkService } from "./application/mentorship-link.service";
import { MentorshipBriefService } from "./application/mentorship-brief.service";
import { MentorshipRosterService } from "./application/mentorship-roster.service";
import { MentorshipTemplateService } from "./application/mentorship-template.service";
import { PlanTaskFeedbackListener } from "./application/plan-task-feedback.listener";
import { MentorshipDroppedAssignmentRepository } from "./infrastructure/mentorship-dropped-assignment.repository";
import { MentorshipInviteCodeRepository } from "./infrastructure/mentorship-invite-code.repository";
import { MentorshipLinkRepository } from "./infrastructure/mentorship-link.repository";
import { MentorshipQueryAdapter } from "./infrastructure/mentorship-query.adapter";
import { MentorshipTemplateRepository } from "./infrastructure/mentorship-template.repository";
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
  // AiModule for the coach brief: W8 owns the gate and the cache, W3 writes the text. Safe one
  // way — ai.module.ts imports identity/content/payments/economy/coaching/forum, never mentorship.
  // PaymentsModule for the PAID seat allowance. W8 stayed free of payments while every seat was
  // free (APP-076 kept the arrow out with events); charging for seats IS coupling, and the seat
  // decision has to be synchronous — it happens inside the accept transaction's lock, where an
  // event would arrive far too late. One-way still: payments imports identity/promotions/coaching.
  imports: [IdentityModule, CoachingModule, AiModule, PaymentsModule],
  controllers: [MentorshipCoachController, MentorshipStudentController],
  providers: [
    MentorshipLinkService,
    MentorshipInviteService,
    MentorshipRosterService,
    MentorshipBriefService,
    MentorshipAssignmentService,
    MentorshipTemplateService,
    MentorshipErasureService,
    PlanTaskFeedbackListener,
    MentorshipLinkRepository,
    MentorshipInviteCodeRepository,
    MentorshipDroppedAssignmentRepository,
    MentorshipTemplateRepository,
    MentorshipQueryAdapter,
    { provide: MENTORSHIP_QUERY_PORT, useExisting: MentorshipQueryAdapter },
  ],
  exports: [MentorshipLinkService, MentorshipErasureService, MENTORSHIP_QUERY_PORT],
})
export class MentorshipModule {}
