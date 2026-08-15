import { Module } from "@nestjs/common";
import { ContentModule } from "../content/content.module";
import { IdentityModule } from "../identity/identity.module";
import { MoodService } from "./application/mood.service";
import { DailyQuestSignalService } from "./application/daily-quest-signal.service";
import { MistakeNotebookService } from "./application/mistake-notebook.service";
import { NotebookForumListener } from "./application/notebook-forum.listener";
import { MockExamService } from "./application/mock-exam.service";
import { PlanService } from "./application/plan.service";
import { SessionService } from "./application/session.service";
import { StreakService } from "./application/streak.service";
import { TodayService } from "./application/today.service";
import { VisionService } from "./application/vision.service";
import { VisionBoardImageService } from "./application/vision-board-image.service";
import { VisionBoardMaintenanceService } from "./application/vision-board-maintenance.service";
import { WeeklyReviewService } from "./application/weekly-review.service";
import { PreferenceSimulationService } from "./application/preference-simulation.service";
import { CoachingErasureService } from "./application/coaching-erasure.service";
import { CoachEvidenceService } from "./application/coach-evidence.service";
import { CONTENT_PORT } from "./domain/content.port";
import { CoachingQueryAdapter } from "./infrastructure/coaching-query.adapter";
import { ContentServiceAdapter } from "./infrastructure/content-service.adapter";
import { COACHING_QUERY_PORT } from "./domain/coaching-query.port";
import { DailyActivityRepository } from "./infrastructure/daily-activity.repository";
import { MoodCheckinRepository } from "./infrastructure/mood-checkin.repository";
import { PlanTaskRepository } from "./infrastructure/plan-task.repository";
import { StreakFreezeRepository } from "./infrastructure/streak-freeze.repository";
import { StreakStateRepository } from "./infrastructure/streak-state.repository";
import { StudySessionRepository } from "./infrastructure/study-session.repository";
import { MistakeNotebookRepository } from "./infrastructure/mistake-notebook.repository";
import { MockExamRepository } from "./infrastructure/mock-exam.repository";
import { MockExamPhotoRepository } from "./infrastructure/mock-exam-photo.repository";
import { VisionBoardRepository } from "./infrastructure/vision-board.repository";
import { WeeklyReviewRepository } from "./infrastructure/weekly-review.repository";
import { PreferenceScenarioRepository } from "./infrastructure/preference-scenario.repository";
import { CoachingErasureRepository } from "./infrastructure/coaching-erasure.repository";
import { CoachingController } from "./presentation/coaching.controller";
import { MistakeNotebookController } from "./presentation/mistake-notebook.controller";
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
  controllers: [
    CoachingController,
    PlanTaskController,
    StudySessionController,
    MockExamController,
    MistakeNotebookController,
  ],
  providers: [
    PlanService,
    MistakeNotebookService,
    NotebookForumListener,
    DailyQuestSignalService,
    SessionService,
    StreakService,
    MoodService,
    MockExamService,
    TodayService,
    VisionService,
    VisionBoardImageService,
    VisionBoardMaintenanceService,
    WeeklyReviewService,
    PreferenceSimulationService,
    CoachingErasureService,
    CoachEvidenceService,
    CoachingErasureRepository,
    PlanTaskRepository,
    StudySessionRepository,
    MistakeNotebookRepository,
    MockExamRepository,
    MockExamPhotoRepository,
    DailyActivityRepository,
    StreakStateRepository,
    StreakFreezeRepository,
    MoodCheckinRepository,
    VisionBoardRepository,
    WeeklyReviewRepository,
    PreferenceScenarioRepository,
    // W1 ContentService adapter (ContentPort → editorial calendar).
    { provide: CONTENT_PORT, useClass: ContentServiceAdapter },
    CoachingQueryAdapter,
    { provide: COACHING_QUERY_PORT, useExisting: CoachingQueryAdapter },
  ],
  exports: [
    COACHING_QUERY_PORT,
    CoachingErasureService,
    CoachEvidenceService,
    DailyQuestSignalService,
    MistakeNotebookService,
    MockExamService,
    MoodService,
    PlanService,
    SessionService,
    VisionService,
    WeeklyReviewService,
    PreferenceSimulationService,
    StreakService,
  ],
})
export class CoachingModule {}










