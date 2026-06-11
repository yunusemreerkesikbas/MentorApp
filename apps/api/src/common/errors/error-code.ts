/**
 * Stable, machine-readable error codes. These are the keys clients branch on AND
 * the i18n keys under `errors.*` (TR/EN). Keep in sync with the locale errors.json files.
 */
export const ErrorCode = {
  INTERNAL_ERROR: "INTERNAL_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  // identity (W0) — module-prefixed, append-only (workstreams rule)
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_EMAIL_IN_USE: "AUTH_EMAIL_IN_USE",
  AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_TURNSTILE_FAILED: "AUTH_TURNSTILE_FAILED",
  AUTH_ACCOUNT_SUSPENDED: "AUTH_ACCOUNT_SUSPENDED",
  // coaching (W2) — module-prefixed, append-only (workstreams rule)
  COACHING_TASK_NOT_FOUND: "COACHING_TASK_NOT_FOUND",
  COACHING_SESSION_NOT_FOUND: "COACHING_SESSION_NOT_FOUND",
  COACHING_SESSION_ALREADY_CLOSED: "COACHING_SESSION_ALREADY_CLOSED",
  // content (W1) — module-prefixed, append-only (workstreams rule)
  CONTENT_EXAM_NOT_FOUND: "CONTENT_EXAM_NOT_FOUND",
  CONTENT_INVALID_EXAM_FAMILY: "CONTENT_INVALID_EXAM_FAMILY",
  CONTENT_ARTICLE_NOT_FOUND: "CONTENT_ARTICLE_NOT_FOUND",
  CONTENT_INVALID_ARTICLE_CATEGORY: "CONTENT_INVALID_ARTICLE_CATEGORY",
  // payments (W4) — module-prefixed, append-only (workstreams rule)
  PAYMENT_TRIAL_ALREADY_USED: "PAYMENT_TRIAL_ALREADY_USED",
  PAYMENT_ALREADY_SUBSCRIBED: "PAYMENT_ALREADY_SUBSCRIBED",
  PAYMENT_PROVIDER_ERROR: "PAYMENT_PROVIDER_ERROR",
  PAYMENT_WEBHOOK_INVALID: "PAYMENT_WEBHOOK_INVALID",
  PAYMENT_PREMIUM_REQUIRED: "PAYMENT_PREMIUM_REQUIRED",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Map a (Nest/HTTP) status to a safe generic code. */
export function httpStatusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case 400:
      return ErrorCode.BAD_REQUEST;
    case 401:
      return ErrorCode.UNAUTHORIZED;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 404:
      return ErrorCode.NOT_FOUND;
    case 409:
      return ErrorCode.CONFLICT;
    case 413:
      return ErrorCode.PAYLOAD_TOO_LARGE;
    case 429:
      return ErrorCode.TOO_MANY_REQUESTS;
    case 503:
      return ErrorCode.SERVICE_UNAVAILABLE;
    default:
      return status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.BAD_REQUEST;
  }
}
