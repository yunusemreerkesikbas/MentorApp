import { HttpStatus } from "@nestjs/common";
import { ErrorCode } from "./error-code";

/**
 * Map a Postgres driver error (SQLSTATE in `err.code`) to a SAFE generic code/status.
 *
 * CRITICAL (backend standard): we never surface the raw DB error/constraint/column to the
 * client. We only translate the class of failure into a generic code; full detail is logged.
 * Returns null for non-pg / unrecognised errors (→ caller treats as INTERNAL_ERROR).
 */
export function mapPostgresError(
  err: unknown,
): { code: ErrorCode; status: number } | null {
  if (!err || typeof err !== "object" || !("code" in err)) return null;
  const code = String((err as { code: unknown }).code);

  switch (code) {
    case "23505": // unique_violation
    case "23503": // foreign_key_violation
      return { code: ErrorCode.CONFLICT, status: HttpStatus.CONFLICT };
    case "23502": // not_null_violation
    case "23514": // check_violation
    case "22P02": // invalid_text_representation
    case "22001": // string_data_right_truncation
    case "22007": // invalid_datetime_format
    case "22008": // datetime_field_overflow
      return { code: ErrorCode.BAD_REQUEST, status: HttpStatus.BAD_REQUEST };
    default:
      // Connection / operator-intervention classes → service unavailable.
      if (code.startsWith("08") || code === "57P01" || code === "53300") {
        return { code: ErrorCode.SERVICE_UNAVAILABLE, status: HttpStatus.SERVICE_UNAVAILABLE };
      }
      return null;
  }
}
