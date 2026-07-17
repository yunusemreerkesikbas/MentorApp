import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import { DRIZZLE } from "../../../../database/database.constants";
import type { Database } from "../../../../database/drizzle";
import { withServiceContext } from "../../../../database/rls";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../../../../shared/ports/job-queue.port";
import { DeliveryTemplate, JobName } from "../../domain/notifications.constants";
import { NotificationPreferencesRepository } from "../../infrastructure/notification-preferences.repository";
import { NotificationsService } from "../notifications.service";

const payloadSchema = z.object({
  userId: z.string().uuid(),
  linkUrl: z.string().min(1).max(512),
  subject: z.string().max(80).nullable().optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Handles `notifications.session-return-reminder` — in-app always, push if prefs allow. */
@Injectable()
export class SessionReturnReminderHandler {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(JOB_QUEUE_PORT) private readonly queue: JobQueuePort,
    private readonly preferences: NotificationPreferencesRepository,
    private readonly notifications: NotificationsService,
  ) {}

  async handle(payload: unknown): Promise<void> {
    const data = payloadSchema.parse(payload);
    const title = "Yarınki adımın bekliyor";
    const body = data.subject
      ? `"${data.subject}" için küçük bir seans yeter. Seninle buradayız.`
      : "Küçük bir seans yeter. Seninle buradayız.";

    await this.notifications.createInApp(data.userId, "COACH", title, body, data.linkUrl);

    const prefs = await withServiceContext(this.db, async (tx) =>
      this.preferences.findByUserIdService(tx, data.userId),
    );
    const pushOn = prefs?.pushEnabled ?? true;
    if (!pushOn) return;

    await this.queue.enqueue(JobName.SEND_PUSH, {
      userId: data.userId,
      title,
      body,
      url: data.linkUrl,
      template: DeliveryTemplate.SESSION_RETURN,
      dedupeKey: `session-return-push:${data.targetDate}`,
    });
  }
}
