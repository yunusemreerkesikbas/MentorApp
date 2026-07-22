import { Inject, Injectable } from "@nestjs/common";
import type { SessionReturnReminderDto } from "@mentor/types";
import type { ScheduleSessionReturnReminderInput } from "@mentor/validation";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../../../shared/ports/job-queue.port";
import { toIsoDate } from "../../coaching/domain/date.util";
import { DeliveryTemplate, JobName } from "../domain/notifications.constants";
import { NotificationDeliveryRepository } from "../infrastructure/notification-delivery.repository";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Build /study-session deep-link with optional subject query (mobile-ready). */
export function buildSessionReturnLinkUrl(subject?: string | null): string {
  const trimmed = subject?.trim();
  if (!trimmed) return "/study-session?source=reminder";
  return `/study-session?subject=${encodeURIComponent(trimmed.slice(0, 80))}&source=reminder`;
}

/**
 * Opt-in soft return: schedule an in-app (+ push) reminder ~24h after the user taps
 * “Yarın hatırlat” on the session done screen. Idempotent per user+target UTC day.
 */
@Injectable()
export class SessionReturnReminderService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(JOB_QUEUE_PORT) private readonly queue: JobQueuePort,
    private readonly deliveries: NotificationDeliveryRepository,
  ) {}

  async schedule(
    userId: string,
    input: ScheduleSessionReturnReminderInput = {},
    now: Date = new Date(),
  ): Promise<SessionReturnReminderDto> {
    const runAt = new Date(now.getTime() + MS_PER_DAY);
    const targetDate = toIsoDate(runAt);
    const dedupeKey = `session-return:${targetDate}`;

    const first = await withServiceContext(this.db, async (tx) =>
      this.deliveries.tryRecord(tx, {
        userId,
        channel: "SCHEDULE",
        template: DeliveryTemplate.SESSION_RETURN,
        dedupeKey,
      }),
    );

    if (!first) {
      return { scheduled: false, alreadyScheduled: true, runAt: null };
    }

    const linkUrl = buildSessionReturnLinkUrl(input.subject);
    await this.queue.enqueue(
      JobName.SESSION_RETURN_REMINDER,
      {
        userId,
        linkUrl,
        subject: input.subject?.trim() || null,
        targetDate,
      },
      { runAt },
    );

    return { scheduled: true, alreadyScheduled: false, runAt: runAt.toISOString() };
  }
}
