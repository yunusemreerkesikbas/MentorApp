import { Inject, Injectable } from "@nestjs/common";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../../../shared/ports/job-queue.port";
import {
  COACHING_QUERY_PORT,
  type CoachingQueryPort,
} from "../../coaching/domain/coaching-query.port";
import { EmailTemplate, JobName } from "../domain/notifications.constants";
import { NotificationDeliveryRepository } from "../infrastructure/notification-delivery.repository";
import { NotificationPreferencesRepository } from "../infrastructure/notification-preferences.repository";
import { NotificationsService } from "./notifications.service";
import { todayIso } from "../../coaching/domain/date.util";

/** Rule-based daily study reminder — coaching data, no AI (W3 deferred). */
@Injectable()
export class DailyReminderService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(JOB_QUEUE_PORT) private readonly queue: JobQueuePort,
    @Inject(COACHING_QUERY_PORT) private readonly coaching: CoachingQueryPort,
    private readonly preferences: NotificationPreferencesRepository,
    private readonly deliveries: NotificationDeliveryRepository,
    private readonly notifications: NotificationsService,
  ) {}

  async dispatchForToday(): Promise<{ enqueued: number; skipped: number }> {
    const dateIso = todayIso();
    const candidates = await this.coaching.listDailyReminderCandidates(dateIso);
    let enqueued = 0;
    let skipped = 0;

    for (const user of candidates) {
      const prefs = await withServiceContext(this.db, async (tx) =>
        this.preferences.findByUserIdService(tx, user.userId),
      );
      const emailOn = prefs?.emailEnabled ?? true;
      const pushOn = prefs?.pushEnabled ?? true;

      const dedupeKey = `daily-reminder:${dateIso}`;
      const title = "Bugün bir adım at";
      const body = "Küçük bir çalışma veya mood check-in bile yeter. Seninle buradayız.";

      // In-app inbox is a separate channel — always create regardless of email/push prefs
      await this.notifications.createInApp(user.userId, "COACH", title, body, "/study-session");

      if (!emailOn && !pushOn) {
        skipped += 1;
        continue;
      }

      if (emailOn) {
        const ok = await withServiceContext(this.db, async (tx) =>
          this.deliveries.tryRecord(tx, {
            userId: user.userId,
            channel: "EMAIL",
            template: EmailTemplate.DAILY_REMINDER,
            dedupeKey,
          }),
        );
        if (ok) {
          await this.queue.enqueue(JobName.SEND_EMAIL, {
            to: user.email,
            template: EmailTemplate.DAILY_REMINDER,
            variables: { displayName: user.displayName },
          });
          enqueued += 1;
        }
      }

      if (pushOn) {
        await this.queue.enqueue(JobName.SEND_PUSH, {
          userId: user.userId,
          title,
          body,
          url: "/dashboard",
          template: EmailTemplate.DAILY_REMINDER,
          dedupeKey,
        });
        enqueued += 1;
      }

    }

    return { enqueued, skipped };
  }
}
