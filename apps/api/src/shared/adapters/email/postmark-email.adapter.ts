import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../../config/env.validation";
import type { EmailPort } from "../../ports/email.port";
import { assertSafeHttpUrl, escapeHtml } from "./email-html.util";

interface PostmarkResponse {
  ErrorCode?: number;
  Message?: string;
}

/**
 * Postmark transactional email adapter (§8).
 * Falls back to logging when POSTMARK_TOKEN is unset (local dev).
 */
@Injectable()
export class PostmarkEmailAdapter implements EmailPort {
  private readonly logger = new Logger(PostmarkEmailAdapter.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

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
    const subject = this.subjectForTemplate(input.template);
    const htmlBody = this.renderHtml(input.template, input.variables ?? {});
    const textBody = this.renderText(input.template, input.variables ?? {});

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
        Subject: subject,
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

  private subjectForTemplate(template: string): string {
    const map: Record<string, string> = {
      "identity.verify-email": "Mentor — E-posta doğrulama",
      "identity.reset-password": "Mentor — Şifre sıfırlama",
      "payments.dunning": "Mentor — Ödeme hatırlatması",
      "payments.subscription-welcome": "Mentor — Premium'a hoş geldin",
      "coaching.daily-reminder": "Mentor — Bugün bir adım at",
    };
    return map[template] ?? "Mentor";
  }

  private renderHtml(template: string, vars: Record<string, unknown>): string {
    if (template === "identity.verify-email" || template === "identity.reset-password") {
      const link = assertSafeHttpUrl(String(vars.link ?? ""));
      const name = escapeHtml(String(vars.displayName ?? ""));
      const href = link ? ` href="${escapeHtml(link)}"` : "";
      return `<p>Merhaba ${name},</p><p><a${href}>Bağlantıya tıkla</a></p>`;
    }
    if (template === "payments.dunning") {
      return `<p>Ödeme işlemin tamamlanamadı. Lütfen abonelik ayarlarını kontrol et.</p>`;
    }
    if (template === "coaching.daily-reminder") {
      const name = escapeHtml(String(vars.displayName ?? ""));
      return `<p>Merhaba ${name},</p><p>Bugün kendine küçük bir adım ayırmak ister misin? Seninle buradayız.</p>`;
    }
    return `<p>Mentor bildirimi</p>`;
  }

  private renderText(template: string, vars: Record<string, unknown>): string {
    if (template === "identity.verify-email" || template === "identity.reset-password") {
      const link = assertSafeHttpUrl(String(vars.link ?? ""));
      return `Merhaba ${String(vars.displayName ?? "")}, bağlantı: ${link || "(geçersiz bağlantı)"}`;
    }
    if (template === "coaching.daily-reminder") {
      return `Merhaba ${String(vars.displayName ?? "")}, bugün kendine küçük bir adım ayırmak ister misin?`;
    }
    return "Mentor bildirimi";
  }
}
