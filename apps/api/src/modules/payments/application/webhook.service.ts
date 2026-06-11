import { Inject, Injectable, Logger } from "@nestjs/common";
import { PAYMENTS_PORT, type PaymentsPort } from "../../../shared/ports/payments.port";
import { PaymentEventsRepository } from "../infrastructure/payments.repositories";
import { SubscriptionsService } from "./subscriptions.service";

/**
 * Webhook pipeline (§7/§8): verify signature → record-once (idempotency belt) → apply.
 * A replayed event is acknowledged with 200 but applied exactly once.
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @Inject(PAYMENTS_PORT) private readonly provider: PaymentsPort,
    private readonly eventsRepo: PaymentEventsRepository,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async handle(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: true; duplicate: boolean }> {
    // Throws PAYMENT_WEBHOOK_INVALID (401/400) on a bad signature/payload — never processed.
    const event = this.provider.verifyWebhook(rawBody, headers);

    // Fast-path duplicate check (cheap select via the unique belt's table).
    const isFirst = await this.eventsRepo.recordWebhookOnce({
      provider: this.provider.provider,
      eventId: event.eventId,
      type: event.type,
      payload: event,
    });
    if (!isFirst) {
      this.logger.warn(`duplicate webhook ignored: ${event.eventId}`);
      return { received: true, duplicate: true };
    }

    try {
      await this.subscriptions.applyProviderEvent(event);
    } catch (err) {
      // CRASH-SAFETY (review F1): if applying fails, the event must NOT stay marked as
      // processed — otherwise the provider's retry would be swallowed as a "duplicate"
      // and the event would be lost forever. Un-record so the retry goes through.
      // (A retried re-apply is safe: the tx ledger dedupes on providerEventId and the
      // status transitions are convergent; worst case is a duplicate domain-event emit.)
      await this.eventsRepo
        .deleteWebhookRecord(this.provider.provider, event.eventId)
        .catch((cleanupErr) =>
          this.logger.error(`webhook un-record failed for ${event.eventId}: ${String(cleanupErr)}`),
        );
      throw err;
    }
    return { received: true, duplicate: false };
  }
}
