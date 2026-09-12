import { Inject, Injectable } from "@nestjs/common";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../../../shared/ports/job-queue.port";
import { todayInIstanbul } from "../../coaching/domain/date.util";
import { MentorshipFollowupService } from "../../mentorship/application/mentorship-followup.service";
import { EmailTemplate, JobName } from "../domain/notifications.constants";
import { NotificationCopyKey } from "../domain/notification-copy";
import { NotificationsService } from "./notifications.service";

@Injectable()
export class MentorshipFollowupDueService {
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
      const count = await this.followups.getDueCount(coachId, now);
      if (count === 0) {
        skipped += 1;
        continue;
      }
      await this.notifications.createFromTemplate(
        coachId,
        "MENTORSHIP",
        NotificationCopyKey.MENTORSHIP_FOLLOWUP_DUE,
        "/students",
        { args: { count }, dedupeKey },
      );
      await this.queue.enqueue(JobName.SEND_EMAIL, {
        template: EmailTemplate.MENTORSHIP_FOLLOWUP_DUE,
        variables: { count },
        executionGuard: { type: "mentorship-followup-due", coachId, dedupeKey },
      });
      sent += 1;
    }

    return { sent, skipped };
  }
}
