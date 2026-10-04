import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isDevToolingAllowed, type Env } from "../../../config/env.validation";
import type { EmailPort } from "../../ports/email.port";

/**
 * Console EmailPort sink for dev tooling (local, CI, APP_ENV=staging): prints the whole message,
 * links and tokens included, so verify/reset flows run without an inbox. `RoutingEmailAdapter`
 * picks it per message (admin switch `dev.email.console_enabled`, or no POSTMARK_TOKEN).
 *
 * Writes to stdout on purpose: the app logger (observability/logger.config.ts) drops every
 * freeform message, which is right for everything else and would swallow the link. This class
 * guards that exception itself: outside dev tooling it prints nothing and fails the job instead.
 */
@Injectable()
export class LoggerEmailAdapter implements EmailPort {
  private readonly devTooling: boolean;

  constructor(env: ConfigService<Env, true>) {
    this.devTooling = isDevToolingAllowed({
      NODE_ENV: env.get("NODE_ENV", { infer: true }),
      APP_ENV: env.get("APP_ENV", { infer: true }),
    });
  }

  async sendTransactional(input: {
    to: string;
    template: string;
    variables?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.devTooling) {
      // Unreachable while production requires POSTMARK_TOKEN and reads the switch as off. Failing
      // the job beats dropping the mail silently or printing a token into production logs.
      throw new Error("Console email is disabled outside dev tooling (APP_ENV=production).");
    }
    // One line: log streams keep it whole, and it greps by address, template or link path.
    process.stdout.write(
      `[email:console] ${input.to} ${input.template} ${JSON.stringify(input.variables ?? {})}\n`,
    );
  }
}
