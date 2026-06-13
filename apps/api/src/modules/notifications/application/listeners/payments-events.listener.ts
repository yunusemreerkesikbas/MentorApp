import { Inject, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DRIZZLE } from "../../../../database/database.constants";
import type { Database } from "../../../../database/drizzle";
import { withServiceContext } from "../../../../database/rls";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../../../../shared/ports/job-queue.port";
import { UsersService } from "../../../identity/application/users.service";
import {
  PaymentFailed,
  PaymentsEventTopic,
  SubscriptionActivated,
} from "../../../payments/domain/payments.events";
import { EmailTemplate, JobName } from "../../domain/notifications.constants";
import { NotificationDeliveryRepository } from "../../infrastructure/notification-delivery.repository";

/** Consumes payments domain events → async notification jobs (W5). */
@Injectable()
export class PaymentsEventsListener {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(JOB_QUEUE_PORT) private readonly queue: JobQueuePort,
    private readonly users: UsersService,
    private readonly deliveries: NotificationDeliveryRepository,
  ) {}

  @OnEvent(PaymentsEventTopic.PAYMENT_FAILED)
  async onPaymentFailed(event: PaymentFailed): Promise<void> {
    const user = await this.users.getNotificationContact(event.userId);
    if (!user) return;

    const dedupeKey = `payment-failed:${event.subscriptionId}:${event.graceUntil.toISOString()}`;
    const ok = await withServiceContext(this.db, async (tx) =>
      this.deliveries.tryRecord(tx, {
        userId: event.userId,
        channel: "EMAIL",
        template: EmailTemplate.PAYMENT_DUNNING,
        dedupeKey,
      }),
    );
    if (!ok) return;

    await this.queue.enqueue(JobName.SEND_EMAIL, {
      to: user.email,
      template: EmailTemplate.PAYMENT_DUNNING,
      variables: {
        displayName: user.displayName,
        graceUntil: event.graceUntil.toISOString(),
      },
    });
  }

  @OnEvent(PaymentsEventTopic.SUBSCRIPTION_ACTIVATED)
  async onSubscriptionActivated(event: SubscriptionActivated): Promise<void> {
    const user = await this.users.getNotificationContact(event.userId);
    if (!user) return;

    const dedupeKey = `subscription-activated:${event.subscriptionId}`;
    const ok = await withServiceContext(this.db, async (tx) =>
      this.deliveries.tryRecord(tx, {
        userId: event.userId,
        channel: "EMAIL",
        template: EmailTemplate.SUBSCRIPTION_WELCOME,
        dedupeKey,
      }),
    );
    if (!ok) return;

    await this.queue.enqueue(JobName.SEND_EMAIL, {
      to: user.email,
      template: EmailTemplate.SUBSCRIPTION_WELCOME,
      variables: { displayName: user.displayName, planId: event.planId },
    });
  }
}
