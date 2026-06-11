import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import { EMAIL_PORT, type EmailPort } from "../../../../shared/ports/email.port";
import { EmailTemplate } from "../../domain/notifications.constants";

const sendEmailPayloadSchema = z.object({
  to: z.string().email(),
  template: z.string().min(1),
  variables: z.record(z.unknown()).optional(),
});

/** Handles `notifications.send-email` jobs. */
@Injectable()
export class SendEmailHandler {
  constructor(@Inject(EMAIL_PORT) private readonly email: EmailPort) {}

  async handle(payload: unknown): Promise<void> {
    const data = sendEmailPayloadSchema.parse(payload);
    await this.email.sendTransactional({
      to: data.to,
      template: data.template as EmailTemplate,
      variables: data.variables,
    });
  }
}
