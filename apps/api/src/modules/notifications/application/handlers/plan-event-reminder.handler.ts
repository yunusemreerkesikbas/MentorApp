import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import { DRIZZLE } from "../../../../database/database.constants";
import type { Database } from "../../../../database/drizzle";
import { withServiceContext } from "../../../../database/rls";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../../../../shared/ports/job-queue.port";
import {
  COACHING_QUERY_PORT,
  type CoachingQueryPort,
  type PlanEventReminderOccurrence,
} from "../../../coaching/domain/coaching-query.port";
import { NotificationCopyKey } from "../../domain/notification-copy";
import { DeliveryTemplate, JobName } from "../../domain/notifications.constants";
import { NotificationPreferencesRepository } from "../../infrastructure/notification-preferences.repository";
import { NotificationsService } from "../notifications.service";
import { planEventStartAt } from "../plan-event-reminder-time";

const payloadSchema = z.object({
  eventId: z.string().uuid(),
  expectedStartAt: z.string().datetime({ offset: true }),
}).strict();

function copyArgs(event: PlanEventReminderOccurrence) {
  return {
    eventTitle: event.title,
    eventDate: event.eventDate,
    eventTime: event.startTime,
  };
}

/** Stale-safe, idempotent fan-out for `notifications.plan-event-reminder`. */
@Injectable()
export class PlanEventReminderHandler {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(COACHING_QUERY_PORT) private readonly coaching: CoachingQueryPort,
    private readonly preferences: NotificationPreferencesRepository,
    private readonly notifications: NotificationsService,
    @Inject(JOB_QUEUE_PORT) private readonly queue: JobQueuePort,
  ) {}

  async handle(payload: unknown): Promise<void> {
    const data = payloadSchema.parse(payload);
    const event = await this.coaching.getPlanEventReminderOccurrence(data.eventId);
    if (event?.status !== "SCHEDULED" || !event.startTime) return;

    const startAt = planEventStartAt(event.eventDate, event.startTime);
    const expectedStartAt = new Date(data.expectedStartAt);
    if (
      startAt.getTime() !== expectedStartAt.getTime() ||
      startAt.getTime() <= Date.now()
    ) {
      return;
    }

    const recipientIds = [
      ...new Set([event.organizerUserId, ...event.attendeeUserIds]),
    ];
    const preferenceRows = await withServiceContext(this.db, (tx) =>
      this.preferences.findByUserIdsService(tx, recipientIds),
    );
    const pushPreference = new Map(
      preferenceRows.map((row) => [row.userId, row.pushEnabled]),
    );
    const args = copyArgs(event);
    const linkUrl = `/plan?date=${encodeURIComponent(event.eventDate)}&event=${encodeURIComponent(event.eventId)}`;
    const copy = this.notifications.resolveCopy(
      NotificationCopyKey.PLAN_EVENT_REMINDER,
      args,
    );

    for (const userId of recipientIds) {
      const dedupeKey = `plan-event:${event.eventId}:${userId}:${expectedStartAt.toISOString()}`;
      await this.notifications.createFromTemplate(
        userId,
        "PLAN",
        NotificationCopyKey.PLAN_EVENT_REMINDER,
        linkUrl,
        { args, dedupeKey },
      );
      if (pushPreference.get(userId) === false) continue;
      await this.queue.enqueue(JobName.SEND_PUSH, {
        userId,
        title: copy.title,
        body: copy.body,
        url: linkUrl,
        template: DeliveryTemplate.PLAN_EVENT_REMINDER,
        dedupeKey,
      });
    }
  }
}
