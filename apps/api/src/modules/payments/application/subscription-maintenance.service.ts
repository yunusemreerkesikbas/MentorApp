import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PaymentsEventTopic, SubscriptionExpired } from "../domain/payments.events";
import { SubscriptionsRepository } from "../infrastructure/payments.repositories";
import { hasRunOut } from "./entitlement.service";

const SWEEP_PAGE_SIZE = 200;
/** Guard against a runaway sweep; a page that changes nothing still advances the cursor. */
const MAX_PAGES = 100;

/**
 * Retires subscriptions whose paid time has run out.
 *
 * Payments is otherwise webhook-driven with no cron (`docs/features/payments.md`), and this is the
 * documented exception. It has to exist: the ONLY other path to EXPIRED is the provider's
 * `subscription_canceled` webhook, so a subscription that simply lapses stays `ACTIVE` in the table
 * forever. That silently breaks anything asking "did this user lose access?" — the WIN_BACK
 * promotion rule among them — and leaves the user unable to buy again, because `findOpenForUser`
 * still counts the stale row as open.
 *
 * `hasRunOut` (not a local predicate) decides, so the sweeper can never disagree with the
 * entitlement the user is shown.
 */
@Injectable()
export class SubscriptionMaintenanceService {
  private readonly logger = new Logger(SubscriptionMaintenanceService.name);
  private sweeping = false;

  constructor(
    private readonly subsRepo: SubscriptionsRepository,
    private readonly events: EventEmitter2,
  ) {}

  async expireNow(now: Date = new Date()): Promise<{ expired: number }> {
    // Overlapping runs would double-emit; a skipped tick is harmless since the next one catches up.
    if (this.sweeping) return { expired: 0 };
    this.sweeping = true;
    const startedAt = Date.now();
    let expired = 0;
    let afterId: string | null = null;

    try {
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const candidates = await this.subsRepo.listMaybeRanOut(now, SWEEP_PAGE_SIZE, afterId);
        if (candidates.length === 0) break;

        for (const sub of candidates) {
          if (!hasRunOut(sub, now)) continue;
          // Compare-and-set on the status we read: a webhook that moved the row first wins, and
          // we stay quiet rather than announcing a transition we did not make.
          const retired = await this.subsRepo.markExpired(sub.id, sub.status);
          if (!retired) continue;
          expired += 1;
          this.events.emit(
            PaymentsEventTopic.SUBSCRIPTION_EXPIRED,
            new SubscriptionExpired(sub.userId, sub.id, sub.planId),
          );
        }

        afterId = candidates[candidates.length - 1]!.id;
        if (candidates.length < SWEEP_PAGE_SIZE) break;
      }

      if (expired > 0) {
        this.logger.log(
          `Subscription expiry sweep expired=${expired} durationMs=${Date.now() - startedAt}`,
        );
      }
      return { expired };
    } finally {
      this.sweeping = false;
    }
  }
}
