import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Agent } from "node:https";
import { pushEndpointSchema } from "@mentor/validation";
import webpush from "web-push";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import type { Env } from "../../../config/env.validation";
import type { PushPort } from "../../ports/push.port";
import { PushEndpointPolicy, UnsafePushEndpointError } from "./push-endpoint-policy";

/** Web Push adapter (VAPID). Logs when keys are unset (local dev). */
@Injectable()
export class WebPushAdapter implements PushPort {
  private readonly logger = new Logger(WebPushAdapter.name);
  private configured = false;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly registry: ConfigRegistryService,
    private readonly endpoints: PushEndpointPolicy,
  ) {
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
    if (!pushEndpointSchema.safeParse(input.endpoint).success) throw new UnsafePushEndpointError();
    if (!this.configured) {
      this.logger.debug("Push delivery skipped: VAPID is not configured");
      return;
    }
    const resolved = await this.endpoints.resolve(input.endpoint);
    const timeoutMs = await this.registry.get("notifications.push.request_timeout_ms") as number;
    // Native HTTPS does not follow redirects. Pin the checked DNS answer while retaining
    // the provider hostname for TLS certificate verification and SNI.
    const agent = new Agent({
      keepAlive: false,
      lookup: (hostname, options, callback) => {
        if (hostname !== resolved.url.hostname) {
          callback(new UnsafePushEndpointError(), "", 4);
          return;
        }
        if (options.all) callback(null, [{ address: resolved.address, family: resolved.family }]);
        else callback(null, resolved.address, resolved.family);
      },
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([webpush.sendNotification(
      {
        endpoint: input.endpoint,
        keys: { p256dh: input.keys.p256dh, auth: input.keys.auth },
      },
      JSON.stringify({
        title: input.title,
        body: input.body,
        url: input.url ?? "/dashboard",
      }),
      { agent, timeout: timeoutMs },
    ), new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        agent.destroy();
        reject(new Error("Push provider request timed out"));
      }, timeoutMs);
    })]);
    } finally {
      clearTimeout(timer);
      agent.destroy();
    }
  }
}
