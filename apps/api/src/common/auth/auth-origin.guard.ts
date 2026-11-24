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
    // The native app has no web origin and holds its refresh token in SecureStore, not a cookie.
    // Skipping the check is safe only while nothing a browser does can look like this: browsers
    // attach Origin to every cross-site POST and cannot add the custom header without a CORS
    // preflight, and with no Cookie header there is no ambient session to ride on.
    if (
      !admin &&
      req.headers["x-client-platform"] === "mobile" &&
      req.headers.origin === undefined &&
      req.headers.cookie === undefined
    ) {
      return true;
    }
    const expected = this.config.get(admin ? "ADMIN_APP_URL" : "APP_URL", { infer: true });
    if (req.headers.origin !== new URL(expected).origin) throw new ForbiddenError();
    return true;
  }
}
