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
import { IdentityModule } from "../identity/identity.module";
import { DailyReminderService } from "./application/daily-reminder.service";
import { SendEmailHandler } from "./application/handlers/send-email.handler";
import { SendPushHandler } from "./application/handlers/send-push.handler";
import { JobHandlersRegistrar } from "./application/job-handlers.registrar";
import { JobRunnerService } from "./application/job-runner.service";
import { PaymentsEventsListener } from "./application/listeners/payments-events.listener";
import { NotificationsService } from "./application/notifications.service";
import { JobRepository } from "./infrastructure/job.repository";
import { NotificationDeliveryRepository } from "./infrastructure/notification-delivery.repository";
import { NotificationPreferencesRepository } from "./infrastructure/notification-preferences.repository";
import { PostgresJobQueueAdapter } from "./infrastructure/postgres-job-queue.adapter";
import { PushSubscriptionRepository } from "./infrastructure/push-subscription.repository";
import { CronController } from "./presentation/cron.controller";
import { CronSecretGuard } from "./presentation/cron-secret.guard";
import { NotificationsController } from "./presentation/notifications.controller";

/**
 * W5 — notifications + JobQueuePort runner (§8).
 * Global exports: JOB_QUEUE_PORT, EMAIL_PORT (identity enqueues auth mail).
 */
@Global()
@Module({
  imports: [IdentityModule, CoachingModule],
  controllers: [CronController, NotificationsController],
  providers: [
    JobRepository,
    PostgresJobQueueAdapter,
    JobRunnerService,
    JobHandlersRegistrar,
    SendEmailHandler,
    SendPushHandler,
    NotificationsService,
    DailyReminderService,
    PaymentsEventsListener,
    NotificationPreferencesRepository,
    PushSubscriptionRepository,
    NotificationDeliveryRepository,
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
  exports: [JOB_QUEUE_PORT, EMAIL_PORT, JobRunnerService],
})
export class NotificationsModule {}
