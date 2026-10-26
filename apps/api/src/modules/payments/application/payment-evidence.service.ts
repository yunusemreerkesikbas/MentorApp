import { Injectable } from "@nestjs/common";
import { PaymentEventsRepository } from "../infrastructure/payments.repositories";

/** Public payment evidence for delayed reward consumers; no payment tables cross module boundaries. */
@Injectable()
export class PaymentEvidenceService {
  constructor(private readonly events: PaymentEventsRepository) {}

  isRefunded(userId: string, paymentId: string): Promise<boolean> {
    return this.events.isPaymentRefunded(userId, paymentId);
  }

  /** Whether this user ever paid real money: any succeeded charge above zero. A trial alone is not payment. */
  hasPaid(userId: string): Promise<boolean> {
    return this.events.hasPositiveCharge(userId);
  }
}
