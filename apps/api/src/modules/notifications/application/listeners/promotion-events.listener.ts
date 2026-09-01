import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DRIZZLE } from "../../../../database/database.constants";
import type { Database } from "../../../../database/drizzle";
import { withServiceContext } from "../../../../database/rls";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../../../../shared/ports/job-queue.port";
import {
  PaymentsEventTopic,
  type SubscriptionExpired,
} from "../../../payments/domain/payments.events";
import { SubscriptionsService } from "../../../payments/application/subscriptions.service";
import { NotificationCopyKey } from "../../domain/notification-copy";
import { JobName } from "../../domain/notifications.constants";
import { NotificationDeliveryRepository } from "../../infrastructure/notification-delivery.repository";
import { NotificationPreferencesRepository } from "../../infrastructure/notification-preferences.repository";
import { NotificationsService } from "../notifications.service";

const WIN_BACK_TEMPLATE = "promotions.win-back";

/**
 * Promotion-driven notifications (W4b × W5).
 *
 * The only one today is win-back, and it exists because it is the single message that reaches a
 * user who has stopped opening the app — every other promotion surface (paywall, dashboard strip,
 * welcome dialog) requires them to already be here.
 *
 * This is a COMMERCIAL message, so unlike the transactional reminders it honours
 * `campaignsEnabled` on every channel including the inbox, and it is sent only when a discount
 * genuinely applies. E-mail is deliberately absent: a discount e-mail is a ticari elektronik ileti
 * under 6563 and needs İYS registration, explicit consent and an opt-out link, none of which
 * exist yet (see `docs/features/promotions.md`).
 */
@Injectable()
export class PromotionEventsListener {
  private readonly logger = new Logger(PromotionEventsListener.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(JOB_QUEUE_PORT) private readonly queue: JobQueuePort,
    private readonly subscriptions: SubscriptionsService,
    private readonly preferences: NotificationPreferencesRepository,
    private readonly deliveries: NotificationDeliveryRepository,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(PaymentsEventTopic.SUBSCRIPTION_EXPIRED)
  async onSubscriptionExpired(event: SubscriptionExpired): Promise<void> {
    try {
      const offer = await this.subscriptions.findWinBackOffer(event.userId);
      // No live campaign for this user: a commercial message with nothing behind it is spam.
      if (!offer?.promotion) return;

      const prefs = await withServiceContext(this.db, (tx) =>
        this.preferences.findByUserIdService(tx, event.userId),
      );
      if (prefs?.campaignsEnabled === false) return;

      const dedupeKey = `win-back:${event.subscriptionId}`;
      const first = await withServiceContext(this.db, (tx) =>
        this.deliveries.tryRecord(tx, {
          userId: event.userId,
          channel: "IN_APP",
          template: WIN_BACK_TEMPLATE,
          dedupeKey,
        }),
      );
      if (!first) return;

      const args = { label: offer.promotion.label };
      await this.notifications.createFromTemplate(
        event.userId,
        "SYSTEM",
        NotificationCopyKey.WIN_BACK_OFFER,
        "/subscription",
        { args, dedupeKey },
      );

      if (prefs?.pushEnabled === false) return;
      const { title, body } = this.notifications.resolveCopy(
        NotificationCopyKey.WIN_BACK_OFFER,
        args,
      );
      await this.queue.enqueue(JobName.SEND_PUSH, {
        userId: event.userId,
        title,
        body,
        url: "/subscription",
        template: WIN_BACK_TEMPLATE,
        dedupeKey,
      });
    } catch (err) {
      // A notification must never break the sweeper that emitted the event.
      this.logger.error(`win-back notification failed for user=${event.userId}: ${String(err)}`);
    }
  }
}
