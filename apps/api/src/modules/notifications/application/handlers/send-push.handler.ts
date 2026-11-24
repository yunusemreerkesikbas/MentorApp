import { Inject, Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { ConfigRegistryService } from "../../../../common/config/config-registry.service";
import { DRIZZLE } from "../../../../database/database.constants";
import type { Database } from "../../../../database/drizzle";
import { withServiceContext } from "../../../../database/rls";
import {
  InvalidMobilePushTokenError,
  MOBILE_PUSH_PORT,
  type MobilePushPort,
} from "../../../../shared/ports/mobile-push.port";
import { PUSH_PORT, type PushPort } from "../../../../shared/ports/push.port";
import { UnsafePushEndpointError } from "../../../../shared/adapters/push/push-endpoint-policy";
import { MobilePushTokenRepository } from "../../infrastructure/mobile-push-token.repository";
import { NotificationDeliveryRepository } from "../../infrastructure/notification-delivery.repository";
import { PushDeliveryRepository } from "../../infrastructure/push-delivery.repository";
import { PushSubscriptionRepository } from "../../infrastructure/push-subscription.repository";

const sendPushPayloadSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1),
  body: z.string().min(1),
  url: z.string().optional(),
  template: z.string().min(1),
  dedupeKey: z.string().min(1),
});

type SendPushPayload = z.infer<typeof sendPushPayloadSchema>;

/** Handles `notifications.send-push` jobs across web and native mobile devices. */
@Injectable()
export class SendPushHandler {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(PUSH_PORT) private readonly push: PushPort,
    private readonly subscriptions: PushSubscriptionRepository,
    private readonly deliveries: NotificationDeliveryRepository,
    private readonly claims: PushDeliveryRepository,
    private readonly registry: ConfigRegistryService,
    @Inject(MOBILE_PUSH_PORT) private readonly mobilePush: MobilePushPort,
    private readonly mobileTokens: MobilePushTokenRepository,
  ) {}

  async handle(payload: unknown): Promise<void> {
    const data = sendPushPayloadSchema.parse(payload);
    const delivery = { userId: data.userId, channel: "PUSH", template: data.template, dedupeKey: data.dedupeKey };

    const targets = await withServiceContext(this.db, async (tx) => {
      if (await this.deliveries.exists(tx, delivery)) return null;
      const [webSubs, expoTokens] = await Promise.all([
        this.subscriptions.listByUserId(tx, data.userId),
        this.mobileTokens.listByUserId(tx, data.userId),
      ]);
      return { webSubs, expoTokens };
    });
    // No target is not a delivery: recording one would swallow a push to someone who subscribes later.
    if (!targets || (targets.webSubs.length === 0 && targets.expoTokens.length === 0)) return;

    const timeoutMs = (await this.registry.get("notifications.push.request_timeout_ms")) as number;
    for (const sub of targets.webSubs) {
      await this.deliverWithClaim(data, sub.endpoint, timeoutMs,
        () => this.push.send({
          endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth },
          title: data.title, body: data.body, url: data.url,
        }),
        isPermanentWebPushError,
        () => withServiceContext(this.db, (tx) => this.subscriptions.deleteByEndpoint(tx, data.userId, sub.endpoint)),
      );
    }
    for (const device of targets.expoTokens) {
      await this.deliverWithClaim(data, `expo:${device.token}`, timeoutMs,
        () => this.mobilePush.send({ token: device.token, title: data.title, body: data.body, url: data.url }),
        (err) => err instanceof InvalidMobilePushTokenError,
        () => withServiceContext(this.db, (tx) => this.mobileTokens.deleteByToken(tx, data.userId, device.token)),
      );
    }
    await withServiceContext(this.db, (tx) => this.deliveries.tryRecord(tx, delivery));
  }

  private async deliverWithClaim(
    data: SendPushPayload, claimKey: string, timeoutMs: number,
    deliver: () => Promise<void>, isPermanentFailure: (err: unknown) => boolean, prune: () => Promise<void>,
  ): Promise<void> {
    const identity = {
      userId: data.userId, template: data.template, dedupeKey: data.dedupeKey,
      endpointHash: createHash("sha256").update(claimKey).digest("hex"),
    };
    const claimToken = randomUUID();
    const claimed = await withServiceContext(this.db, (tx) =>
      this.claims.claim(tx, identity, claimToken, new Date(Date.now() + timeoutMs * 3)));
    if (claimed === "delivered") return;
    if (claimed === "busy") throw new Error("Push delivery is already in progress");
    try {
      try {
        await deliver();
      } catch (err) {
        if (!isPermanentFailure(err)) throw err;
        await prune();
      }
      await withServiceContext(this.db, (tx) => this.claims.complete(tx, identity, claimToken));
    } catch (error) {
      await withServiceContext(this.db, (tx) => this.claims.release(tx, identity, claimToken));
      throw error;
    }
  }
}

function isPermanentWebPushError(err: unknown): boolean {
  const statusCode =
    err && typeof err === "object" && "statusCode" in err
      ? Number((err as { statusCode: number }).statusCode)
      : 0;
  return statusCode === 404 || statusCode === 410 || err instanceof UnsafePushEndpointError;
}
