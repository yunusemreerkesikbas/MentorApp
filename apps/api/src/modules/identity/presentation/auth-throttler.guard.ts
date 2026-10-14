import { Inject, Injectable } from "@nestjs/common";
import { ThrottlerException, ThrottlerGuard } from "@nestjs/throttler";
import type { ThrottlerRequest } from "@nestjs/throttler/dist/throttler.guard.interface";
import type { Request, Response } from "express";
import { AuthRateLimitService, type AuthRateBucket } from "../application/auth-rate-limit.service";

@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  @Inject(AuthRateLimitService) private readonly authRates!: AuthRateLimitService;

  protected override async handleRequest(props: ThrottlerRequest): Promise<boolean> {
    const req = props.context.switchToHttp().getRequest<Request>();
    const path = req.path.toLowerCase().replace(/^\/v1/, "").replace(/\/$/, "");
    if (!path.startsWith("/auth/")) return super.handleRequest(props);
    const res = props.context.switchToHttp().getResponse<Response>();
    const bucket = authRateBucket(path);
    const ip = await this.authRates.consumeIp(bucket, req.ip ?? req.socket.remoteAddress ?? "unknown", bucket === "login" ? "login" : path);
    if (!ip.allowed) { res.header("Retry-After", String(ip.retryAfter)); throw new ThrottlerException(); }
    return true;
  }
}

export function authRateBucket(path: string): AuthRateBucket {
  const route = path.replace(/^\/auth\/(?:admin\/)?/, "").replace(/\/$/, "");
  if (route === "login" || route === "signup" || route === "refresh") return route;
  if (route === "forgot-password") return "forgot";
  if (route === "reset-password") return "reset";
  if (route === "verify-email") return "verify";
  if (route === "google/start" || route === "google/callback") return "oauth";
  return "other";
}
