import { Inject, Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { ConfigRegistryService } from "../../../../common/config/config-registry.service";
import { DRIZZLE } from "../../../../database/database.constants";
import type { Database } from "../../../../database/drizzle";
import { withServiceContext } from "../../../../database/rls";
import { PUSH_PORT, type PushPort } from "../../../../shared/ports/push.port";
import { UnsafePushEndpointError } from "../../../../shared/adapters/push/push-endpoint-policy";
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

/** Handles `notifications.send-push` jobs. */
@Injectable()
export class SendPushHandler {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(PUSH_PORT) private readonly push: PushPort,
    private readonly subscriptions: PushSubscriptionRepository,
    private readonly deliveries: NotificationDeliveryRepository,
    private readonly claims: PushDeliveryRepository,
    private readonly registry: ConfigRegistryService,
  ) {}

  async handle(payload: unknown): Promise<void> {
    const data = sendPushPayloadSchema.parse(payload);

    const delivery = { userId: data.userId, channel: "PUSH", template: data.template, dedupeKey: data.dedupeKey };
    const subs = await withServiceContext(this.db, async (tx) => {
      if (await this.deliveries.exists(tx, delivery)) return null;
      return this.subscriptions.listByUserId(tx, data.userId);
    });
    if (!subs) return;
    const timeoutMs = await this.registry.get("notifications.push.request_timeout_ms") as number;
    for (const sub of subs) {
      const identity = { userId: data.userId, template: data.template, dedupeKey: data.dedupeKey,
        endpointHash: createHash("sha256").update(sub.endpoint).digest("hex") };
      const claimToken = randomUUID();
      // One bounded DNS resolution plus one bounded request, with one interval for DB finalization.
      const claimed = await withServiceContext(this.db, (tx) =>
        this.claims.claim(tx, identity, claimToken, new Date(Date.now() + timeoutMs * 3)));
      if (claimed === "delivered") continue;
      if (claimed === "busy") throw new Error("Push delivery is already in progress");
      try {
        try {
          await this.push.send({
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
            title: data.title,
            body: data.body,
            url: data.url,
          });
        } catch (err) {
          const statusCode =
            err && typeof err === "object" && "statusCode" in err
              ? Number((err as { statusCode: number }).statusCode)
              : 0;
          if (statusCode !== 404 && statusCode !== 410 && !(err instanceof UnsafePushEndpointError)) throw err;
          await withServiceContext(this.db, (tx) =>
            this.subscriptions.deleteByEndpoint(tx, data.userId, sub.endpoint));
        }
        await withServiceContext(this.db, (tx) => this.claims.complete(tx, identity, claimToken));
      } catch (error) {
        await withServiceContext(this.db, (tx) => this.claims.release(tx, identity, claimToken));
        throw error;
      }
    }
    await withServiceContext(this.db, (tx) => this.deliveries.tryRecord(tx, delivery));
  }
}
