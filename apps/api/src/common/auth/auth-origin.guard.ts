import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import type { Env } from "../../config/env.validation";
import { ForbiddenError } from "../errors/domain-error";

/** Cookie-bearing auth mutations accept only their own browser application's exact origin. */
@Injectable()
export class AuthOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const path = req.originalUrl.split("?", 1)[0]!;
    if (req.method !== "POST" || !/^\/(?:v1\/)?auth(?:\/|$)/i.test(path)) return true;
    const admin = /^\/(?:v1\/)?auth\/admin(?:\/|$)/i.test(path);
    const expected = this.config.get(admin ? "ADMIN_APP_URL" : "APP_URL", { infer: true });
    if (req.headers.origin !== new URL(expected).origin) throw new ForbiddenError();
    return true;
  }
}
