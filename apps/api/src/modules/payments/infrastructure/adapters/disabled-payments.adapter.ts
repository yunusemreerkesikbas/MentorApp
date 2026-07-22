import { HttpStatus, Injectable } from "@nestjs/common";
import { DomainError } from "../../../../common/errors/domain-error";
import { ErrorCode } from "../../../../common/errors/error-code";
import type {
  CheckoutRequest,
  CheckoutResult,
  PaymentsPort,
  ProviderEvent,
  RefundResult,
} from "../../../../shared/ports/payments.port";

@Injectable()
export class DisabledPaymentsAdapter implements PaymentsPort {
  readonly provider = "DISABLED" as const;
  readonly instantCheckout = false;

  async createCheckout(_req: CheckoutRequest): Promise<CheckoutResult> {
    this.unavailable();
  }

  async cancel(_providerRef: string): Promise<void> {
    this.unavailable();
  }

  async refund(
    _providerRef: string,
    _amountMinor: number,
    _idempotencyKey: string,
  ): Promise<RefundResult> {
    this.unavailable();
  }

  verifyWebhook(
    _rawBody: Buffer,
    _headers: Record<string, string | string[] | undefined>,
  ): ProviderEvent {
    return this.unavailable();
  }

  private unavailable(): never {
    throw new DomainError(ErrorCode.PAYMENT_DISABLED, HttpStatus.SERVICE_UNAVAILABLE);
  }
}
