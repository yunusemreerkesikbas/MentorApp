import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpStatus } from "@nestjs/common";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { Env } from "../../../config/env.validation";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Cloudflare Turnstile (bot/Sybil shield — §3/§8). Enforced only when the secret is
 * configured; in dev (no secret) it's a no-op so local signup works without Cloudflare.
 */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async assertValid(token: string | undefined): Promise<void> {
    const secret = this.config.get("TURNSTILE_SECRET_KEY", { infer: true });
    if (!secret) return; // not configured (dev) → skip

    if (!token) {
      throw new DomainError(ErrorCode.AUTH_TURNSTILE_FAILED, HttpStatus.BAD_REQUEST);
    }
    try {
      const res = await fetch(SITEVERIFY_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token }),
      });
      const body = (await res.json()) as { success?: boolean };
      if (!body.success) {
        throw new DomainError(ErrorCode.AUTH_TURNSTILE_FAILED, HttpStatus.BAD_REQUEST);
      }
    } catch (err) {
      if (err instanceof DomainError) throw err;
      // Cloudflare unreachable: log and fail closed (bot shield must not silently open).
      this.logger.error(`Turnstile verify failed: ${String(err)}`);
      throw new DomainError(ErrorCode.AUTH_TURNSTILE_FAILED, HttpStatus.BAD_REQUEST);
    }
  }
}
