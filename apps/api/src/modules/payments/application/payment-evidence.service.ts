import { Injectable } from "@nestjs/common";
import { PaymentEventsRepository } from "../infrastructure/payments.repositories";

/** Public payment evidence for delayed reward consumers; no payment tables cross module boundaries. */
@Injectable()
export class PaymentEvidenceService {
  constructor(private readonly events: PaymentEventsRepository) {}

  isRefunded(userId: string, paymentId: string): Promise<boolean> {
    return this.events.isPaymentRefunded(userId, paymentId);
  }
}
