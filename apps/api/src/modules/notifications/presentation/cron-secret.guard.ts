import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import type { Env } from "../../../config/env.validation";

/** Protects internal cron endpoints — shared secret via header (Render Cron). */
@Injectable()
export class CronSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expected = this.config.get("CRON_SECRET", { infer: true });
    if (!expected) {
      throw new UnauthorizedException();
    }
    const provided =
      req.header("x-cron-secret") ??
      req.header("authorization")?.replace(/^Bearer\s+/i, "") ??
      "";
    if (!this.safeEqual(provided, expected)) {
      throw new UnauthorizedException();
    }
    return true;
  }

  /** Constant-time comparison — avoids leaking the secret via response timing. */
  private safeEqual(provided: string, expected: string): boolean {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    // timingSafeEqual throws on length mismatch; the length check itself is not secret.
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
