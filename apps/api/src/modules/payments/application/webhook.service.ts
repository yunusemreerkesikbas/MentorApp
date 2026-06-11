import { Inject, Injectable, Logger } from "@nestjs/common";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { PAYMENTS_PORT, type PaymentsPort } from "../../../shared/ports/payments.port";
import { PaymentEventsRepository } from "../infrastructure/payments.repositories";
import { SubscriptionsService, type WebhookSideEffects } from "./subscriptions.service";

/**
 * Webhook pipeline (§7/§8): verify signature → record-once + apply in ONE transaction
 * (idempotency record and state mutation commit or roll back together) → publish
 * side-effects after commit. A replayed event is acknowledged with 200 but applied exactly once.
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @Inject(PAYMENTS_PORT) private readonly provider: PaymentsPort,
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly eventsRepo: PaymentEventsRepository,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async handle(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: true; duplicate: boolean }> {
    // Throws PAYMENT_WEBHOOK_INVALID (401/400) on a bad signature/payload — never processed.
    const event = this.provider.verifyWebhook(rawBody, headers);

    // Record + apply atomically: if the apply throws, the idempotency row rolls back with it,
    // so the provider's retry is processed afresh (no event lost, none double-recorded). The
    // ledger's unique providerEventId keeps a retried re-apply a no-op.
    const sideEffects = await withServiceContext(this.db, async (tx): Promise<WebhookSideEffects | null> => {
      const isFirst = await this.eventsRepo.recordWebhookOnce(
        {
          provider: this.provider.provider,
          eventId: event.eventId,
          type: event.type,
          payload: event,
        },
        tx,
      );
      if (!isFirst) return null; // duplicate — nothing applied
      return this.subscriptions.applyProviderEvent(event, tx);
    });

    if (!sideEffects) {
      this.logger.warn(`duplicate webhook ignored: ${event.eventId}`);
      return { received: true, duplicate: true };
    }

    // Domain-event emits + invoice issuance run only after the tx committed.
    await this.subscriptions.runSideEffects(sideEffects);
    return { received: true, duplicate: false };
  }
}
