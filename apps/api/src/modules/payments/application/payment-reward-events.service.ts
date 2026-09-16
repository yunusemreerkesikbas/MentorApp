import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { z } from "zod";
import type { DatabaseTx } from "../../../database/drizzle";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../../../shared/ports/job-queue.port";
import { JobRunnerService } from "../../notifications/application/job-runner.service";
import { PaymentRefunded, PaymentSucceeded, PaymentsEventTopic } from "../domain/payments.events";

const JOB = "payments.deliver-reward-event";
const payloadSchema = z.discriminatedUnion("topic", [
  z.object({
    topic: z.literal(PaymentsEventTopic.PAYMENT_SUCCEEDED),
    event: z.object({ userId: z.string().uuid(), subscriptionId: z.string().uuid(),
      paymentId: z.string().min(1), amountMinor: z.number().int().positive(), paidAt: z.coerce.date() }),
  }),
  z.object({
    topic: z.literal(PaymentsEventTopic.PAYMENT_REFUNDED),
    event: z.object({ userId: z.string().uuid(), subscriptionId: z.string().uuid(),
      sourcePaymentId: z.string().min(1), amountMinor: z.number().int().positive() }),
  }),
]);

/** The existing jobs table is the outbox: a payment and its reward event commit together. */
@Injectable()
export class PaymentRewardEventsService implements OnModuleInit {
  constructor(
    @Inject(JOB_QUEUE_PORT) private readonly queue: JobQueuePort,
    private readonly runner: JobRunnerService,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit(): void {
    this.runner.registerHandler(JOB, async (raw) => {
      const payload = payloadSchema.parse(raw);
      // Economy listeners propagate failures, so the queue retries rather than completing falsely.
      await this.events.emitAsync(payload.topic, payload.event);
    });
  }

  async append(event: PaymentSucceeded | PaymentRefunded, transaction: DatabaseTx): Promise<void> {
    const topic = event instanceof PaymentSucceeded
      ? PaymentsEventTopic.PAYMENT_SUCCEEDED : PaymentsEventTopic.PAYMENT_REFUNDED;
    await this.queue.enqueue(JOB, { topic, event }, { transaction });
  }
}
