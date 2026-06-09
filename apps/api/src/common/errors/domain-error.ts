import { HttpStatus } from "@nestjs/common";
import { ErrorCode } from "./error-code";

/**
 * Base class for expected, domain-level failures (§engineering-principles).
 *
 * Modules throw these; the global filter maps them to a localized `ApiError`.
 * `details` must be SAFE to expose to the client (no SQL/internal info).
 */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode | string,
    readonly httpStatus: number = HttpStatus.BAD_REQUEST,
    readonly details?: unknown,
  ) {
    super(typeof code === "string" ? code : "DomainError");
    this.name = new.target.name;
  }
}

export class ValidationFailedError extends DomainError {
  constructor(details?: unknown) {
    super(ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST, details);
  }
}
export class NotFoundError extends DomainError {
  constructor(details?: unknown) {
    super(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, details);
  }
}
export class ConflictError extends DomainError {
  constructor(details?: unknown) {
    super(ErrorCode.CONFLICT, HttpStatus.CONFLICT, details);
  }
}
export class UnauthorizedError extends DomainError {
  constructor(details?: unknown) {
    super(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, details);
  }
}
export class ForbiddenError extends DomainError {
  constructor(details?: unknown) {
    super(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, details);
  }
}
