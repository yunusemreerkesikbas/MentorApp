import { Injectable, type OnModuleInit } from "@nestjs/common";
import { JobRunnerService } from "../../notifications/application/job-runner.service";
import {
  MENTORSHIP_WEEKLY_BRIEF_JOB,
  MentorshipWeeklyBriefService,
} from "./mentorship-weekly-brief.service";

@Injectable()
export class MentorshipWeeklyJobRegistrar implements OnModuleInit {
  constructor(
    private readonly runner: JobRunnerService,
    private readonly briefs: MentorshipWeeklyBriefService,
  ) {}

  onModuleInit(): void {
    this.runner.registerHandler(MENTORSHIP_WEEKLY_BRIEF_JOB, (payload) =>
      this.briefs.handle(payload),
    );
  }
}
