import { ApiClientError } from "@mentor/api-client";

const PREMIUM_REQUIRED = "PAYMENT_PREMIUM_REQUIRED";

export function isPremiumRequiredError(error: unknown): boolean {
  return error instanceof ApiClientError && error.body.code === PREMIUM_REQUIRED;
}
