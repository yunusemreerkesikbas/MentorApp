import { Controller, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../../common/auth/public.decorator";
import { DailyReminderService } from "../application/daily-reminder.service";
import { JobRunnerService } from "../application/job-runner.service";
import { NotebookReviewReminderService } from "../application/notebook-review-reminder.service";
import { MentorshipRiskDigestService } from "../application/mentorship-risk-digest.service";
import { CronSecretGuard } from "../../../common/auth/cron-secret.guard";

/** Internal cron triggers (Render Cron → HTTP, no continuous polling). */
@ApiTags("internal")
@Public()
@Controller("internal/cron")
@UseGuards(CronSecretGuard)
export class CronController {
  constructor(
    private readonly runner: JobRunnerService,
    private readonly dailyReminders: DailyReminderService,
    private readonly notebookReviews: NotebookReviewReminderService,
    private readonly mentorshipRiskDigest: MentorshipRiskDigestService,
  ) {}

  @Post("process-jobs")
  processJobs() {
    return this.runner.processBatch();
  }

  @Post("dispatch-daily-reminders")
  dispatchDailyReminders() {
    return this.dailyReminders.dispatchForToday();
  }

  /** Its own trigger, not folded into the daily reminder: different audience, different cadence. */
  @Post("dispatch-notebook-reviews")
  dispatchNotebookReviews() {
    return this.notebookReviews.dispatchDue();
  }

  /**
   * The coach's morning digest. Separate trigger and a later hour than the student reminder:
   * the coach should read a picture the students' own nudge has already had a chance to change.
   */
  @Post("dispatch-mentorship-risk-digest")
  dispatchMentorshipRiskDigest() {
    return this.mentorshipRiskDigest.dispatchDaily();
  }
}
