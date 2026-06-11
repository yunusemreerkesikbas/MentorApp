import { Controller, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../../common/auth/public.decorator";
import { DailyReminderService } from "../application/daily-reminder.service";
import { JobRunnerService } from "../application/job-runner.service";
import { CronSecretGuard } from "./cron-secret.guard";

/** Internal cron triggers (Render Cron → HTTP, no continuous polling). */
@ApiTags("internal")
@Public()
@Controller("internal/cron")
@UseGuards(CronSecretGuard)
export class CronController {
  constructor(
    private readonly runner: JobRunnerService,
    private readonly dailyReminders: DailyReminderService,
  ) {}

  @Post("process-jobs")
  processJobs() {
    return this.runner.processBatch();
  }

  @Post("dispatch-daily-reminders")
  dispatchDailyReminders() {
    return this.dailyReminders.dispatchForToday();
  }
}
