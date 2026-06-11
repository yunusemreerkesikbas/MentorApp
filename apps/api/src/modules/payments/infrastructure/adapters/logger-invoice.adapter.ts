import { Injectable, Logger } from "@nestjs/common";
import type { InvoicePort } from "../../../../shared/ports/invoice.port";

/** Dev stub: logs the would-be e-Arşiv invoice. Replaced by the real integrator post Phase-0. */
@Injectable()
export class LoggerInvoiceAdapter implements InvoicePort {
  private readonly logger = new Logger("Invoice(dev)");

  async issueForCharge(input: {
    userId: string;
    userEmail: string;
    amountMinor: number;
    currency: string;
    description: string;
    providerEventId: string;
  }): Promise<void> {
    this.logger.log(
      `e-Arşiv (stub) → ${input.userEmail} ${(input.amountMinor / 100).toFixed(2)} ${input.currency} [${input.description}] evt=${input.providerEventId}`,
    );
  }
}
