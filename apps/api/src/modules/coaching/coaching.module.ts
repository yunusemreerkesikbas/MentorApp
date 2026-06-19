import { Module } from "@nestjs/common";
import { ContentModule } from "../content/content.module";
import { IdentityModule } from "../identity/identity.module";
import { MoodService } from "./application/mood.service";
import { MockExamService } from "./application/mock-exam.service";
import { PlanService } from "./application/plan.service";
import { SessionService } from "./application/session.service";
import { StreakService } from "./application/streak.service";
import { TodayService } from "./application/today.service";
import { CONTENT_PORT } from "./domain/content.port";
import { CoachingQueryAdapter } from "./infrastructure/coaching-query.adapter";
import { ContentServiceAdapter } from "./infrastructure/content-service.adapter";
import { COACHING_QUERY_PORT } from "./domain/coaching-query.port";
import { DailyActivityRepository } from "./infrastructure/daily-activity.repository";
import { MoodCheckinRepository } from "./infrastructure/mood-checkin.repository";
import { PlanTaskRepository } from "./infrastructure/plan-task.repository";
import { StreakStateRepository } from "./infrastructure/streak-state.repository";
import { StudySessionRepository } from "./infrastructure/study-session.repository";
import { MockExamRepository } from "./infrastructure/mock-exam.repository";
import { MockExamPhotoRepository } from "./infrastructure/mock-exam-photo.repository";
import { CoachingController } from "./presentation/coaching.controller";
import { MockExamController } from "./presentation/mock-exam.controller";
import { PlanTaskController } from "./presentation/plan-task.controller";
import { StudySessionController } from "./presentation/study-session.controller";

/**
 * W2 — coaching bounded context: daily loop (plan tasks · Pomodoro sessions · read-time streak)
 * + rule-based mood check-in. Behavioral data is per-user, RLS-scoped.
 *
 * Cross-track seam: ContentPort is bound to W1 ContentService via {@link ContentServiceAdapter}.
 * Identity's UsersService is consumed for the current user's profile (displayName + examType).
 */
@Module({
  imports: [ContentModule, IdentityModule],
  controllers: [CoachingController, PlanTaskController, StudySessionController, MockExamController],
  providers: [
    PlanService,
    SessionService,
    StreakService,
    MoodService,
    MockExamService,
    TodayService,
    PlanTaskRepository,
    StudySessionRepository,
    MockExamRepository,
    MockExamPhotoRepository,
    DailyActivityRepository,
    StreakStateRepository,
    MoodCheckinRepository,
    // W1 ContentService adapter (ContentPort → editorial calendar).
    { provide: CONTENT_PORT, useClass: ContentServiceAdapter },
    CoachingQueryAdapter,
    { provide: COACHING_QUERY_PORT, useExisting: CoachingQueryAdapter },
  ],
  exports: [COACHING_QUERY_PORT, MockExamService, MoodService],
})
export class CoachingModule {}
