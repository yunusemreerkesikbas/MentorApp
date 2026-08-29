import { Inject, Injectable } from "@nestjs/common";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../../../shared/ports/job-queue.port";
import {
  COACHING_QUERY_PORT,
  type CoachingQueryPort,
} from "../../coaching/domain/coaching-query.port";
import { todayIso } from "../../coaching/domain/date.util";
import { DeliveryTemplate, JobName } from "../domain/notifications.constants";
import { NotificationCopyKey } from "../domain/notification-copy";
import { NotificationDeliveryRepository } from "../infrastructure/notification-delivery.repository";
import { NotificationPreferencesRepository } from "../infrastructure/notification-preferences.repository";
import { NotificationsService } from "./notifications.service";

/** Deep link straight into the review flow — a reminder that lands on a menu is a reminder ignored. */
export const NOTEBOOK_REVIEW_LINK = "/notebook?review=due";

/**
 * The nudge that turns the notebook from an archive into a habit.
 *
 * A paper notebook fails at exactly this step: the writing down is easy, the going back never
 * happens. This service is the going back. It is also the one place the tone rules bite hardest —
 * a reminder about mistakes is one sentence away from shaming, so it carries a count and an
 * invitation, never a scold or a streak the user can break (§0).
 *
 * No email channel, deliberately: an email about unreviewed mistakes arrives hours late, out of
 * context, and reads like a debt collector. In-app and push only.
 */
@Injectable()
export class NotebookReviewReminderService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(JOB_QUEUE_PORT) private readonly queue: JobQueuePort,
    @Inject(COACHING_QUERY_PORT) private readonly coaching: CoachingQueryPort,
    private readonly preferences: NotificationPreferencesRepository,
    private readonly deliveries: NotificationDeliveryRepository,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * One pass over everyone with entries due.
   *
   * Deduped per user per UTC day, so running the cron more than once — or two API instances racing
   * it — cannot produce two nudges. `tryRecord` is the gate: it either inserts the delivery row or
   * tells us somebody already did.
   */
  async dispatchDue(now: Date = new Date()): Promise<{ sent: number; skipped: number }> {
    const dateIso = todayIso();
    const candidates = await this.coaching.listNotebookReviewCandidates(now);
    let sent = 0;
    let skipped = 0;

    for (const candidate of candidates) {
      const dedupeKey = `notebook-review:${dateIso}`;
      const first = await withServiceContext(this.db, async (tx) =>
        this.deliveries.tryRecord(tx, {
          userId: candidate.userId,
          channel: "SCHEDULE",
          template: DeliveryTemplate.NOTEBOOK_REVIEW,
          dedupeKey,
        }),
      );
      if (!first) {
        skipped += 1;
        continue;
      }

      const templateKey =
        candidate.dueCount === 1
          ? NotificationCopyKey.NOTEBOOK_REVIEW_SINGULAR
          : NotificationCopyKey.NOTEBOOK_REVIEW_PLURAL;
      const args = candidate.dueCount === 1 ? {} : { count: candidate.dueCount };
      const { title, body } = this.notifications.resolveCopy(templateKey, args);

      // In-app inbox is its own channel — created regardless of push preference.
      await this.notifications.createFromTemplate(
        candidate.userId,
        "COACH",
        templateKey,
        NOTEBOOK_REVIEW_LINK,
        { args },
      );
      sent += 1;

      const prefs = await withServiceContext(this.db, async (tx) =>
        this.preferences.findByUserIdService(tx, candidate.userId),
      );
      if (!(prefs?.pushEnabled ?? true)) continue;

      await this.queue.enqueue(JobName.SEND_PUSH, {
        userId: candidate.userId,
        title,
        body,
        url: NOTEBOOK_REVIEW_LINK,
        template: DeliveryTemplate.NOTEBOOK_REVIEW,
        dedupeKey: `notebook-review-push:${dateIso}`,
      });
    }

    return { sent, skipped };
  }
}
