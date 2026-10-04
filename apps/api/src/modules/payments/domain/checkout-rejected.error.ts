import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";

/** Explicit provider evidence that no checkout/payment was created; transport errors are NOT this. */
export class CheckoutRejectedError extends DomainError {
  constructor(code: string = ErrorCode.PAYMENT_PROVIDER_ERROR) { super(code, 503); }
}
