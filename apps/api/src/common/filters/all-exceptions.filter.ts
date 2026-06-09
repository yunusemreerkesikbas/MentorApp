import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { I18nContext } from "nestjs-i18n";
import type { ApiError } from "@mentor/types";
import { Sentry } from "../../observability/sentry";
import { DomainError } from "../errors/domain-error";
import { ErrorCode, httpStatusToErrorCode } from "../errors/error-code";
import { mapPostgresError } from "../errors/postgres-error";

interface ApiErrorBody extends ApiError {
  requestId?: string;
}

const HEALTH_PATH = /\/health(\/ready)?$/;

/**
 * Global exception filter — every API error leaves as a localized `ApiError { code, message, details? }`.
 *
 * Guardrails (§engineering-principles / backend standard):
 *  - Raw SQL/DB/internal errors and stack traces are NEVER returned to the client → generic code/message.
 *  - Full detail (stack, original error) is logged server-side (pino + Sentry).
 *  - Only DomainError/validation details (which we author) are exposed; pg/unknown carry no details.
 *
 * Exception: health probes (`/health`, `/health/ready`) keep their own terminus body so the up/down
 * shapes stay consistent and machine-readable for orchestrators — they are infra, not the API contract.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exceptions");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();
    const requestId = req?.id;

    // Let terminus own health responses (consistent up/down body).
    if (exception instanceof HttpException && HEALTH_PATH.test(req?.path ?? "")) {
      if (!res.headersSent) res.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCode.INTERNAL_ERROR;
    let details: unknown;

    if (exception instanceof DomainError) {
      status = exception.httpStatus;
      code = String(exception.code);
      details = exception.details; // authored, safe to expose
    } else {
      const pg = mapPostgresError(exception);
      if (pg) {
        status = pg.status;
        code = pg.code;
      } else if (exception instanceof HttpException) {
        status = exception.getStatus();
        code = httpStatusToErrorCode(status);
      }
      // else: unknown → stays 500 INTERNAL_ERROR, no details (no leak).
    }

    const i18n = this.currentI18n();
    const message = this.translateCode(i18n, code);
    if (code === ErrorCode.VALIDATION_ERROR) {
      details = this.localizeFieldDetails(i18n, details);
    }

    // Always log internals server-side; 5xx as error (with stack), 4xx as warn.
    const line = `[${requestId ?? "-"}] ${status} ${code}`;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(line, exception instanceof Error ? exception.stack : String(exception));
      Sentry.captureException(exception, { tags: { code, requestId: requestId ?? "-" } });
    } else {
      this.logger.warn(line);
    }

    const body: ApiErrorBody = { code, message };
    if (details !== undefined) body.details = details;
    if (requestId) body.requestId = requestId;

    if (!res.headersSent) {
      res.status(status).json(body);
    }
  }

  private currentI18n(): I18nContext | undefined {
    try {
      return I18nContext.current() ?? undefined;
    } catch {
      return undefined;
    }
  }

  /** Resolve a localized message by error code; fall back to the code if i18n is unavailable. */
  private translateCode(i18n: I18nContext | undefined, code: string): string {
    const key = `errors.${code}`;
    const translated = i18n?.translate(key) as unknown as string | undefined;
    return translated && translated !== key ? translated : code;
  }

  /** Localize each Zod field issue's message via `validation.<issueCode>` (fallback to the raw message). */
  private localizeFieldDetails(i18n: I18nContext | undefined, details: unknown): unknown {
    if (!i18n || !Array.isArray(details)) return details;
    return details.map((item) => {
      if (item && typeof item === "object" && "code" in item) {
        const issueCode = String((item as { code: unknown }).code);
        const key = `validation.${issueCode}`;
        const translated = i18n.translate(key) as unknown as string | undefined;
        if (translated && translated !== key) {
          return { ...(item as object), message: translated };
        }
      }
      return item;
    });
  }
}
