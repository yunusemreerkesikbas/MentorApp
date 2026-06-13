import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import { DRIZZLE } from "../../../../database/database.constants";
import type { Database } from "../../../../database/drizzle";
import { withServiceContext } from "../../../../database/rls";
import { PUSH_PORT, type PushPort } from "../../../../shared/ports/push.port";
import { NotificationDeliveryRepository } from "../../infrastructure/notification-delivery.repository";
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
  ) {}

  async handle(payload: unknown): Promise<void> {
    const data = sendPushPayloadSchema.parse(payload);

    await withServiceContext(this.db, async (tx) => {
      const first = await this.deliveries.tryRecord(tx, {
        userId: data.userId,
        channel: "PUSH",
        template: data.template,
        dedupeKey: data.dedupeKey,
      });
      if (!first) return;

      const subs = await this.subscriptions.listByUserId(tx, data.userId);
      for (const sub of subs) {
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
          if (statusCode === 404 || statusCode === 410) {
            await this.subscriptions.deleteByEndpoint(tx, data.userId, sub.endpoint);
          }
        }
      }
    });
  }
}
