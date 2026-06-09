import { Injectable, Logger } from "@nestjs/common";
import type { EmailPort } from "../../ports/email.port";

/**
 * Dev/test EmailPort adapter: logs the message instead of sending.
 * W5 (notifications) replaces this with the Postmark adapter via DI — flow code unchanged.
 * Tokens/links appear in the log so local verify/reset flows are fully testable.
 */
@Injectable()
export class LoggerEmailAdapter implements EmailPort {
  private readonly logger = new Logger("Email(dev)");

  async sendTransactional(input: {
    to: string;
    template: string;
    variables?: Record<string, unknown>;
  }): Promise<void> {
    this.logger.log(`→ ${input.to} [${input.template}] ${JSON.stringify(input.variables ?? {})}`);
  }
}
