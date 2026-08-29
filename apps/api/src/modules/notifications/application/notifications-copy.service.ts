import { Injectable } from "@nestjs/common";
import { I18nContext, I18nService } from "nestjs-i18n";
import { EMAIL_COPY_KEY } from "../../../shared/notifications/constants";
import {
  type EmailCopy,
  type NotificationCopy,
  type NotificationCopyKey,
} from "../domain/notification-copy";

const FALLBACK_LANG = "tr";

function resolveLang(lang?: string): string {
  const raw = lang ?? I18nContext.current()?.lang ?? FALLBACK_LANG;
  return raw.toLowerCase().startsWith("en") ? "en" : "tr";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

@Injectable()
export class NotificationsCopyService {
  constructor(private readonly i18n: I18nService) {}

  resolve(
    templateKey: NotificationCopyKey,
    args: Record<string, unknown> = {},
    lang?: string,
  ): NotificationCopy {
    const locale = resolveLang(lang);
    return {
      title: this.translate(`notifications.inApp.${templateKey}.title`, args, locale),
      body: this.translate(`notifications.inApp.${templateKey}.body`, args, locale),
    };
  }

  resolveEmail(templateId: string, args: Record<string, unknown> = {}, lang?: string): EmailCopy {
    const locale = resolveLang(lang);
    const key = EMAIL_COPY_KEY[templateId] ?? "fallback";
    return {
      subject: this.translate(`notifications.email.${key}.subject`, args, locale),
      greeting: this.optionalTranslate(`notifications.email.${key}.greeting`, args, locale),
      body: this.translate(`notifications.email.${key}.body`, args, locale),
      cta: this.optionalTranslate(`notifications.email.${key}.cta`, args, locale),
    };
  }

  /**
   * Re-resolve stored inbox copy when `data.templateKey` is present. Missing/legacy rows
   * keep the persisted title/body (no migration).
   */
  resolveStored(
    stored: { title: string; body: string; data: Record<string, unknown> | null },
    lang?: string,
  ): NotificationCopy {
    const templateKey = stored.data?.templateKey;
    if (typeof templateKey !== "string") {
      return { title: stored.title, body: stored.body };
    }
    const args = isRecord(stored.data?.args) ? stored.data.args : {};
    const copy = this.resolve(templateKey as NotificationCopyKey, args, lang);
    if (copy.title.startsWith("notifications.inApp.")) {
      return { title: stored.title, body: stored.body };
    }
    return copy;
  }

  private translate(key: string, args: Record<string, unknown>, lang: string): string {
    return String(this.i18n.translate(key, { lang, args }));
  }

  private optionalTranslate(key: string, args: Record<string, unknown>, lang: string): string {
    const value = this.translate(key, args, lang);
    return value.startsWith("notifications.email.") ? "" : value;
  }
}
