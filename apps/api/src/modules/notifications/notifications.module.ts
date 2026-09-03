import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env.validation";
import { LoggerEmailAdapter } from "../../shared/adapters/email/logger-email.adapter";
import { PostmarkEmailAdapter } from "../../shared/adapters/email/postmark-email.adapter";
import { WebPushAdapter } from "../../shared/adapters/push/web-push.adapter";
import { EMAIL_PORT } from "../../shared/ports/email.port";
import { JOB_QUEUE_PORT } from "../../shared/ports/job-queue.port";
import { PUSH_PORT } from "../../shared/ports/push.port";
import { CoachingModule } from "../coaching/coaching.module";
import { PaymentsModule } from "../payments/payments.module";
import { IdentityModule } from "../identity/identity.module";
import { MentorshipModule } from "../mentorship/mentorship.module";
import { DailyReminderService } from "./application/daily-reminder.service";
import { NotebookReviewReminderService } from "./application/notebook-review-reminder.service";
import { MentorshipRiskDigestService } from "./application/mentorship-risk-digest.service";
import { AnnouncementDispatchHandler } from "./application/handlers/announcement-dispatch.handler";
import { SendEmailHandler } from "./application/handlers/send-email.handler";
import { SendPushHandler } from "./application/handlers/send-push.handler";
import { SessionReturnReminderHandler } from "./application/handlers/session-return-reminder.handler";
import { JobHandlersRegistrar } from "./application/job-handlers.registrar";
import { JobRunnerService } from "./application/job-runner.service";
import { BuddyActivityListener } from "./application/listeners/buddy-activity.listener";
import { StudyRoomActivityListener } from "./application/listeners/study-room-activity.listener";
import { CoachingEventsListener } from "./application/listeners/coaching-events.listener";
import { ForumEventsListener } from "./application/listeners/forum-events.listener";
import { IdentityEventsListener } from "./application/listeners/identity-events.listener";
import { MentorshipEventsListener } from "./application/listeners/mentorship-events.listener";
import { JourneyLevelEventsListener } from "./application/listeners/journey-level-events.listener";
import { AchievementEventsListener } from "./application/listeners/achievement-events.listener";
import { PaymentsEventsListener } from "./application/listeners/payments-events.listener";
import { PromotionEventsListener } from "./application/listeners/promotion-events.listener";
import { AnnouncementService } from "./application/announcement.service";
import { NotificationsCopyService } from "./application/notifications-copy.service";
import { NotificationsService } from "./application/notifications.service";
import { NotificationsErasureService } from "./application/notifications-erasure.service";
import { SessionReturnReminderService } from "./application/session-return-reminder.service";
import { AnnouncementRepository } from "./infrastructure/announcement.repository";
import { JobRepository } from "./infrastructure/job.repository";
import { NotificationDeliveryRepository } from "./infrastructure/notification-delivery.repository";
import { NotificationPreferencesRepository } from "./infrastructure/notification-preferences.repository";
import { PostgresJobQueueAdapter } from "./infrastructure/postgres-job-queue.adapter";
import { PushSubscriptionRepository } from "./infrastructure/push-subscription.repository";
import { UserNotificationRepository } from "./infrastructure/user-notification.repository";
import { CronSecretGuard } from "../../common/auth/cron-secret.guard";
import { CronController } from "./presentation/cron.controller";
import { NotificationsController } from "./presentation/notifications.controller";

/**
 * W5 — notifications + JobQueuePort runner (§8).
 * Global exports: JOB_QUEUE_PORT, EMAIL_PORT (identity enqueues auth mail).
 */
@Global()
@Module({
  // MentorshipModule for MENTORSHIP_QUERY_PORT. No cycle: mentorship imports identity +
  // coaching, neither of which imports this module (it is @Global).
  imports: [IdentityModule, CoachingModule, PaymentsModule, MentorshipModule],
  controllers: [CronController, NotificationsController],
  providers: [
    JobRepository,
    PostgresJobQueueAdapter,
    JobRunnerService,
    JobHandlersRegistrar,
    SendEmailHandler,
    SendPushHandler,
    SessionReturnReminderHandler,
    AnnouncementDispatchHandler,
    NotificationsService,
    NotificationsCopyService,
    AnnouncementService,
    NotificationsErasureService,
    DailyReminderService,
    NotebookReviewReminderService,
    MentorshipRiskDigestService,
    SessionReturnReminderService,
    PaymentsEventsListener,
    PromotionEventsListener,
    CoachingEventsListener,
    MentorshipEventsListener,
    BuddyActivityListener,
    StudyRoomActivityListener,
    ForumEventsListener,
    IdentityEventsListener,
    JourneyLevelEventsListener,
    AchievementEventsListener,
    NotificationPreferencesRepository,
    PushSubscriptionRepository,
    NotificationDeliveryRepository,
    UserNotificationRepository,
    AnnouncementRepository,
    CronSecretGuard,
    LoggerEmailAdapter,
    PostmarkEmailAdapter,
    WebPushAdapter,
    {
      provide: JOB_QUEUE_PORT,
      useExisting: PostgresJobQueueAdapter,
    },
    {
      provide: EMAIL_PORT,
      inject: [ConfigService, LoggerEmailAdapter, PostmarkEmailAdapter],
      useFactory: (
        config: ConfigService<Env, true>,
        logger: LoggerEmailAdapter,
        postmark: PostmarkEmailAdapter,
      ) => (config.get("POSTMARK_TOKEN", { infer: true }) ? postmark : logger),
    },
    { provide: PUSH_PORT, useClass: WebPushAdapter },
  ],
  exports: [
    JOB_QUEUE_PORT,
    EMAIL_PORT,
    JobRunnerService,
    NotificationsErasureService,
    // Consumed by AdminAnnouncementsController (module is @Global — no import needed there).
    AnnouncementService,
  ],
})
export class NotificationsModule {}
