import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import type { Env } from "../../../config/env.validation";
import type { EmailPort } from "../../ports/email.port";
import { LoggerEmailAdapter } from "./logger-email.adapter";
import { PostmarkEmailAdapter } from "./postmark-email.adapter";

/**
 * EMAIL_PORT. Chooses the delivery per message, so flipping the admin switch
 * `dev.email.console_enabled` takes effect without a restart. The registry reads that switch as off
 * in production, and production requires POSTMARK_TOKEN, so production always sends.
 */
@Injectable()
export class RoutingEmailAdapter implements EmailPort {
  private readonly postmarkConfigured: boolean;

  constructor(
    env: ConfigService<Env, true>,
    private readonly registry: ConfigRegistryService,
    private readonly consoleSink: LoggerEmailAdapter,
    private readonly postmark: PostmarkEmailAdapter,
  ) {
    this.postmarkConfigured = Boolean(env.get("POSTMARK_TOKEN", { infer: true }));
  }

  async sendTransactional(input: {
    to: string;
    template: string;
    variables?: Record<string, unknown>;
  }): Promise<void> {
    const toConsole =
      (await this.registry.get("dev.email.console_enabled")) || !this.postmarkConfigured;
    await (toConsole ? this.consoleSink : this.postmark).sendTransactional(input);
  }
}
