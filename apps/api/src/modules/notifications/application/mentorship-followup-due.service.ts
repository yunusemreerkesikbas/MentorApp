import { Inject, Injectable, Logger } from "@nestjs/common";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../../../shared/ports/job-queue.port";
import { todayInIstanbul } from "../../coaching/domain/date.util";
import { MentorshipFollowupService } from "../../mentorship/application/mentorship-followup.service";
import { EmailTemplate, JobName } from "../domain/notifications.constants";
import { NotificationCopyKey } from "../domain/notification-copy";
import { NotificationsService } from "./notifications.service";

@Injectable()
export class MentorshipFollowupDueService {
  private readonly logger = new Logger(MentorshipFollowupDueService.name);

  constructor(
    @Inject(JOB_QUEUE_PORT) private readonly queue: JobQueuePort,
    private readonly followups: MentorshipFollowupService,
    private readonly notifications: NotificationsService,
  ) {}

  async dispatchDaily(now: Date = new Date()): Promise<{ sent: number; skipped: number }> {
    const coachIds = await this.followups.listDueCoachIds(now);
    const dedupeKey = `mentorship-followup-due:${todayInIstanbul(now)}`;
    let sent = 0;
    let skipped = 0;

    for (const coachId of coachIds) {
      try {
        const count = await this.followups.getDueCount(coachId, now);
        if (count === 0) {
          skipped += 1;
          continue;
        }
        const created = await this.notifications.createFromTemplate(
          coachId,
          "MENTORSHIP",
          NotificationCopyKey.MENTORSHIP_FOLLOWUP_DUE,
          "/students",
          { args: { count }, dedupeKey },
        );
        // Queued even when the inbox row already existed: a run that died between the two still
        // gets its email on the retry, and SendEmailHandler's delivery claim stops a second send.
        await this.queue.enqueue(JobName.SEND_EMAIL, {
          template: EmailTemplate.MENTORSHIP_FOLLOWUP_DUE,
          variables: { count },
          executionGuard: { type: "mentorship-followup-due", coachId, dedupeKey },
        });
        if (created) sent += 1;
        else skipped += 1;
      } catch (error) {
        // One coach's failure must not cost every coach after them their morning summary.
        skipped += 1;
        this.logger.error(`Follow-up due summary failed for coach ${coachId}`, error as Error);
      }
    }

    return { sent, skipped };
  }
}
