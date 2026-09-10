import { Inject, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../../../../shared/ports/job-queue.port";
import {
  CoachingEventTopic,
  PlanEventCancelled,
  PlanEventCreated,
  type PlanEventOccurrencePayload,
  PlanEventUpdated,
} from "../../../coaching/domain/coaching.events";
import {
  NotificationCopyKey,
  type NotificationCopyKey as NotificationCopyKeyType,
} from "../../domain/notification-copy";
import { JobName } from "../../domain/notifications.constants";
import { NotificationsService } from "../notifications.service";
import { planEventReminderSchedule } from "../plan-event-reminder-time";

function orderedOccurrences(
  occurrences: PlanEventOccurrencePayload[],
): PlanEventOccurrencePayload[] {
  return [...occurrences].sort((left, right) =>
    left.eventDate.localeCompare(right.eventDate) ||
    (left.startTime ?? "").localeCompare(right.startTime ?? "") ||
    left.eventId.localeCompare(right.eventId),
  );
}

function firstOccurrenceByRecipient(
  event: PlanEventCreated,
): Map<string, PlanEventOccurrencePayload> {
  const firstByRecipient = new Map<string, PlanEventOccurrencePayload>();
  for (const occurrence of orderedOccurrences(event.occurrences)) {
    for (const userId of occurrence.recipientUserIds) {
      if (userId !== event.organizerUserId && !firstByRecipient.has(userId)) {
        firstByRecipient.set(userId, occurrence);
      }
    }
  }
  return firstByRecipient;
}

function copyArgs(occurrence: PlanEventOccurrencePayload) {
  const base = {
    eventTitle: occurrence.title,
    eventDate: occurrence.eventDate,
  };
  return occurrence.startTime
    ? { ...base, eventTime: occurrence.startTime }
    : base;
}

function eventLink(occurrence: PlanEventOccurrencePayload): string {
  return `/plan?date=${encodeURIComponent(occurrence.eventDate)}&event=${encodeURIComponent(occurrence.eventId)}`;
}

/** Best-effort W2 lifecycle summaries and reminder scheduling after commit. */
@Injectable()
export class PlanEventNotificationsListener {
  constructor(
    private readonly notifications: NotificationsService,
    @Inject(JOB_QUEUE_PORT) private readonly queue: JobQueuePort,
  ) {}

  @OnEvent(CoachingEventTopic.PLAN_EVENT_CREATED)
  async onCreated(event: PlanEventCreated): Promise<void> {
    await Promise.allSettled([
      this.notifyAttendees(
        event,
        NotificationCopyKey.PLAN_EVENT_CREATED,
        NotificationCopyKey.PLAN_EVENT_CREATED_ALL_DAY,
      ),
      this.scheduleReminders(event),
    ]);
  }

  @OnEvent(CoachingEventTopic.PLAN_EVENT_UPDATED)
  async onUpdated(event: PlanEventUpdated): Promise<void> {
    await Promise.allSettled([
      this.notifyAttendees(
        event,
        NotificationCopyKey.PLAN_EVENT_UPDATED,
        NotificationCopyKey.PLAN_EVENT_UPDATED_ALL_DAY,
      ),
      this.scheduleReminders(event),
    ]);
  }

  @OnEvent(CoachingEventTopic.PLAN_EVENT_CANCELLED)
  async onCancelled(event: PlanEventCancelled): Promise<void> {
    await Promise.allSettled([
      this.notifyAttendees(
        event,
        NotificationCopyKey.PLAN_EVENT_CANCELLED,
        NotificationCopyKey.PLAN_EVENT_CANCELLED_ALL_DAY,
      ),
    ]);
  }

  private async notifyAttendees(
    event: PlanEventCreated,
    timedTemplateKey: NotificationCopyKeyType,
    allDayTemplateKey: NotificationCopyKeyType,
  ): Promise<void> {
    await Promise.allSettled(
      [...firstOccurrenceByRecipient(event)].map(([userId, occurrence]) =>
        this.notifications.createFromTemplate(
          userId,
          "PLAN",
          occurrence.startTime ? timedTemplateKey : allDayTemplateKey,
          eventLink(occurrence),
          { args: copyArgs(occurrence) },
        ),
      ),
    );
  }

  private async scheduleReminders(event: PlanEventCreated): Promise<void> {
    const now = new Date();
    const jobs = event.occurrences.flatMap((occurrence) => {
      if (occurrence.status !== "SCHEDULED") return [];
      const schedule = planEventReminderSchedule(occurrence, now);
      if (!schedule) return [];
      return [
        this.queue.enqueue(
          JobName.PLAN_EVENT_REMINDER,
          {
            eventId: occurrence.eventId,
            expectedStartAt: schedule.expectedStartAt,
          },
          { runAt: schedule.runAt },
        ),
      ];
    });
    await Promise.allSettled(jobs);
  }
}
