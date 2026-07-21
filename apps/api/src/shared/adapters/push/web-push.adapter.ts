import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import webpush from "web-push";
import type { Env } from "../../../config/env.validation";
import type { PushPort } from "../../ports/push.port";

/** Web Push adapter (VAPID). Logs when keys are unset (local dev). */
@Injectable()
export class WebPushAdapter implements PushPort {
  private readonly logger = new Logger(WebPushAdapter.name);
  private configured = false;

  constructor(private readonly config: ConfigService<Env, true>) {
    const publicKey = config.get("VAPID_PUBLIC_KEY", { infer: true });
    const privateKey = config.get("VAPID_PRIVATE_KEY", { infer: true });
    const subject = config.get("VAPID_SUBJECT", { infer: true }) ?? "mailto:hello@mentor.app";
    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.configured = true;
    }
  }

  async send(input: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    title: string;
    body: string;
    url?: string;
  }): Promise<void> {
    if (!this.configured) {
      this.logger.log(
        `push → ${input.endpoint.slice(0, 48)}… title=${input.title} body=${input.body}`,
      );
      return;
    }

    await webpush.sendNotification(
      {
        endpoint: input.endpoint,
        keys: { p256dh: input.keys.p256dh, auth: input.keys.auth },
      },
      JSON.stringify({
        title: input.title,
        body: input.body,
        url: input.url ?? "/dashboard",
      }),
    );
  }
}
