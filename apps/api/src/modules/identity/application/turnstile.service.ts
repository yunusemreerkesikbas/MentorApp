import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpStatus } from "@nestjs/common";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { Env } from "../../../config/env.validation";
import { safeErrorMetadata } from "../../../observability/safe-diagnostics";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Cloudflare Turnstile (bot/Sybil shield — §3/§8). Enforced only when the secret is
 * configured in dev; production requires a key and fails closed even if validation is bypassed.
 */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async assertValid(token: string | undefined): Promise<void> {
    const secret = this.config.get("TURNSTILE_SECRET_KEY", { infer: true });
    const production = this.config.get("NODE_ENV", { infer: true }) === "production";
    if (!secret?.trim()) {
      if (production) throw new DomainError(ErrorCode.AUTH_TURNSTILE_FAILED, HttpStatus.BAD_REQUEST);
      return; // Unconfigured development/test environments intentionally bypass the widget.
    }
    const hostname = this.config.get("TURNSTILE_EXPECTED_HOSTNAME", { infer: true });
    const action = this.config.get("TURNSTILE_EXPECTED_ACTION", { infer: true });

    if (!token || token.length > 2048 || (production && (!hostname || !action))) {
      throw new DomainError(ErrorCode.AUTH_TURNSTILE_FAILED, HttpStatus.BAD_REQUEST);
    }
    try {
      const res = await fetch(SITEVERIFY_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token }),
        signal: AbortSignal.timeout(this.config.get("TURNSTILE_VERIFY_TIMEOUT_MS", { infer: true })),
        redirect: "error",
      });
      if (!res.ok) throw new DomainError(ErrorCode.AUTH_TURNSTILE_FAILED, HttpStatus.BAD_REQUEST);
      const body: unknown = await res.json();
      if (!body || typeof body !== "object" ||
        !("success" in body) || body.success !== true ||
        (hostname && (!("hostname" in body) || body.hostname !== hostname)) ||
        (action && (!("action" in body) || body.action !== action))) {
        throw new DomainError(ErrorCode.AUTH_TURNSTILE_FAILED, HttpStatus.BAD_REQUEST);
      }
    } catch (err) {
      if (err instanceof DomainError) throw err;
      // Cloudflare unreachable: log and fail closed (bot shield must not silently open).
      this.logger.error({ event: "turnstile.verify_failed", err: safeErrorMetadata(err) });
      throw new DomainError(ErrorCode.AUTH_TURNSTILE_FAILED, HttpStatus.BAD_REQUEST);
    }
  }
}
