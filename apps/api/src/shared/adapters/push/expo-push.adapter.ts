import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mobilePushTokenSchema } from "@mentor/validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import type { Env } from "../../../config/env.validation";
import { InvalidMobilePushTokenError, type MobilePushPort } from "../../ports/mobile-push.port";

const EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoPushTicket {
  status?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoPushResponse {
  data?: ExpoPushTicket | ExpoPushTicket[];
}

/** Native mobile push adapter backed by Expo Push API (routes to FCM v1 / APNs). */
@Injectable()
export class ExpoPushAdapter implements MobilePushPort {
  private readonly accessToken: string | undefined;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly registry: ConfigRegistryService,
  ) {
    const raw = this.config.get("EXPO_ACCESS_TOKEN", { infer: true });
    this.accessToken = raw?.trim() || undefined;
  }

  async send(input: {
    token: string;
    title: string;
    body: string;
    url?: string;
  }): Promise<void> {
    if (!mobilePushTokenSchema.safeParse(input.token).success) {
      throw new InvalidMobilePushTokenError("Malformed Expo push token");
    }

    const timeoutMs = (await this.registry.get("notifications.push.request_timeout_ms")) as number;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    };
    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(EXPO_PUSH_SEND_URL, {
      method: "POST",
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        to: input.token,
        title: input.title,
        body: input.body,
        sound: "default",
        data: { url: input.url ?? "/dashboard" },
      }),
    });

    if (!response.ok) {
      throw new Error(`Expo push delivery failed with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as ExpoPushResponse;
    const ticket = Array.isArray(payload.data) ? payload.data[0] : payload.data;
    if (!ticket) {
      throw new Error("Expo push response contained no ticket");
    }

    if (ticket.status === "error") {
      if (ticket.details?.error === "DeviceNotRegistered") {
        throw new InvalidMobilePushTokenError(ticket.message ?? "DeviceNotRegistered");
      }
      throw new Error(
        `Expo push ticket error (${ticket.details?.error ?? "unknown"}): ${ticket.message ?? ""}`,
      );
    }
  }
}
