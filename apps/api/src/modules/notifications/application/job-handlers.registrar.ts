import { Injectable, OnModuleInit } from "@nestjs/common";
import { SendEmailHandler } from "./handlers/send-email.handler";
import { SendPushHandler } from "./handlers/send-push.handler";
import { SessionReturnReminderHandler } from "./handlers/session-return-reminder.handler";
import { JobRunnerService } from "./job-runner.service";
import { JobName } from "../domain/notifications.constants";

/** Registers all W5 job handlers on the runner (extension point for W3). */
@Injectable()
export class JobHandlersRegistrar implements OnModuleInit {
  constructor(
    private readonly runner: JobRunnerService,
    private readonly sendEmail: SendEmailHandler,
    private readonly sendPush: SendPushHandler,
    private readonly sessionReturn: SessionReturnReminderHandler,
  ) {}

  onModuleInit(): void {
    this.runner.registerHandler(JobName.SEND_EMAIL, (p) => this.sendEmail.handle(p));
    this.runner.registerHandler(JobName.SEND_PUSH, (p) => this.sendPush.handle(p));
    this.runner.registerHandler(JobName.SESSION_RETURN_REMINDER, (p) =>
      this.sessionReturn.handle(p),
    );
  }
}
