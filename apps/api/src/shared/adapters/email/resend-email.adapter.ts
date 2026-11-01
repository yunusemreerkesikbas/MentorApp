import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { I18nService } from "nestjs-i18n";
import type { Env } from "../../../config/env.validation";
import type { EmailPort } from "../../ports/email.port";
import { renderEmail } from "./email-render";

const EMAIL_REQUEST_TIMEOUT_MS = 10_000;

function emailLang(vars: Record<string, unknown>): "tr" | "en" {
  const raw = String(vars.lang ?? "tr").toLowerCase();
  return raw.startsWith("en") ? "en" : "tr";
}

/**
 * Resend transactional adapter. Console delivery remains restricted to dev tooling.
 * Copy lives in `notifications.email.*`; the HTML/text bodies come from `renderEmail`.
 */
@Injectable()
export class ResendEmailAdapter implements EmailPort {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly i18n: I18nService,
  ) {}

  async sendTransactional(input: {
    to: string;
    template: string;
    variables?: Record<string, unknown>;
  }): Promise<void> {
    const token = this.config.get("RESEND_API_KEY", { infer: true }) ?? "";
    const sender = this.config.get("RESEND_FROM", { infer: true }) ?? "noreply@puhukoc.com";
    // Subjects carry no brand prefix, so the inbox must show "PuhuKoç" as the sender name.
    const from = sender.includes("<") ? sender : `PuhuKoç <${sender}>`;
    const vars = input.variables ?? {};
    const lang = emailLang(vars);
    const { subject, html: htmlBody, text: textBody } = renderEmail({
      template: input.template,
      vars,
      lang,
      appUrl: this.config.get("APP_URL", { infer: true }),
      t: (key, args) => this.optional(`notifications.${key}`, args ?? {}, lang),
    });

    let res: Response;
    try {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ from, to: input.to, subject, html: htmlBody, text: textBody }),
        signal: AbortSignal.timeout(EMAIL_REQUEST_TIMEOUT_MS),
      });
    } catch {
      // Provider/network errors can echo recipients, auth links or credentials into job logs.
      throw new Error("Resend request failed");
    }

    if (!res.ok) {
      throw new Error(`Resend delivery failed (HTTP ${res.status})`);
    }
  }

  private optional(key: string, args: Record<string, unknown>, lang: string): string {
    const value = String(this.i18n.translate(key, { lang, args }));
    return value.startsWith("notifications.email.") ? "" : value;
  }
}
