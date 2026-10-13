import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import type { Env } from "../../config/env.validation";
import { secretEqual } from "./secret-equal";

/** Protects internal cron endpoints — shared secret via header (Render Cron). Cross-cutting: used by
 * any module exposing an `internal/cron` endpoint (notifications, forum). */
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
    if (!secretEqual(provided, expected)) {
      throw new UnauthorizedException();
    }
    return true;
  }

}
