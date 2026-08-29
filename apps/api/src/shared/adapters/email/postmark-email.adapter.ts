import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { I18nService } from "nestjs-i18n";
import type { Env } from "../../../config/env.validation";
import type { EmailPort } from "../../ports/email.port";
import { EMAIL_COPY_KEY } from "../../notifications/constants";
import { assertSafeHttpUrl, escapeHtml } from "./email-html.util";

interface PostmarkResponse {
  ErrorCode?: number;
  Message?: string;
}

function emailLang(vars: Record<string, unknown>): string {
  const raw = String(vars.lang ?? "tr").toLowerCase();
  return raw.startsWith("en") ? "en" : "tr";
}

/**
 * Postmark transactional email adapter (§8).
 * Falls back to logging when POSTMARK_TOKEN is unset (local dev).
 * Student-facing sentences live in `notifications.email.*` i18n — HTML is only a skeleton.
 */
@Injectable()
export class PostmarkEmailAdapter implements EmailPort {
  private readonly logger = new Logger(PostmarkEmailAdapter.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly i18n: I18nService,
  ) {}

  async sendTransactional(input: {
    to: string;
    template: string;
    variables?: Record<string, unknown>;
  }): Promise<void> {
    const token = this.config.get("POSTMARK_TOKEN", { infer: true });
    if (!token) {
      this.logger.log(`→ ${input.to} [${input.template}] ${JSON.stringify(input.variables ?? {})}`);
      return;
    }

    const from =
      this.config.get("POSTMARK_FROM", { infer: true }) ?? "noreply@mentor.app";
    const vars = input.variables ?? {};
    const lang = emailLang(vars);
    const copy = this.emailCopy(input.template, vars, lang);
    const htmlBody = this.renderHtml(input.template, vars, copy);
    const textBody = this.renderText(input.template, vars, copy);

    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": token,
      },
      body: JSON.stringify({
        From: from,
        To: input.to,
        Subject: copy.subject,
        HtmlBody: htmlBody,
        TextBody: textBody,
        MessageStream: "outbound",
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as PostmarkResponse;
      throw new Error(body.Message ?? `Postmark error ${res.status}`);
    }
  }

  private emailCopy(template: string, vars: Record<string, unknown>, lang: string) {
    const key = EMAIL_COPY_KEY[template] ?? "fallback";
    const args = { name: String(vars.displayName ?? "") };
    return {
      subject: this.t(`notifications.email.${key}.subject`, args, lang),
      greeting: this.optional(`notifications.email.${key}.greeting`, args, lang),
      body: this.t(`notifications.email.${key}.body`, args, lang),
      cta: this.optional(`notifications.email.${key}.cta`, args, lang),
    };
  }

  private t(key: string, args: Record<string, unknown>, lang: string): string {
    return String(this.i18n.translate(key, { lang, args }));
  }

  private optional(key: string, args: Record<string, unknown>, lang: string): string {
    const value = this.t(key, args, lang);
    return value.startsWith("notifications.email.") ? "" : value;
  }

  private renderHtml(
    template: string,
    vars: Record<string, unknown>,
    copy: { greeting: string; body: string; cta: string },
  ): string {
    const greeting = copy.greeting ? `<p>${escapeHtml(copy.greeting)}</p>` : "";
    const body = `<p>${escapeHtml(copy.body)}</p>`;
    if (template === "identity.verify-email" || template === "identity.reset-password") {
      const link = assertSafeHttpUrl(String(vars.link ?? ""));
      const href = link ? ` href="${escapeHtml(link)}"` : "";
      const cta = escapeHtml(copy.cta || copy.body);
      return `${greeting}${body}<p><a${href}>${cta}</a></p>`;
    }
    return `${greeting}${body}`;
  }

  private renderText(
    template: string,
    vars: Record<string, unknown>,
    copy: { greeting: string; body: string },
  ): string {
    const lead = [copy.greeting, copy.body].filter(Boolean).join(" ");
    if (template === "identity.verify-email" || template === "identity.reset-password") {
      const link = assertSafeHttpUrl(String(vars.link ?? ""));
      return `${lead} ${link || ""}`.trim();
    }
    return lead;
  }
}
