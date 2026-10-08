import { createHmac } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { AuthRateLimitRepository } from "../infrastructure/auth-rate-limit.repository";

export type AuthRateBucket = "login" | "signup" | "forgot" | "reset" | "verify" | "refresh" | "oauth" | "other";

@Injectable()
export class AuthRateLimitService {
  constructor(private readonly repo: AuthRateLimitRepository,
    private readonly env: ConfigService, private readonly registry: ConfigRegistryService) {}

  async consumeIp(bucket: AuthRateBucket, ip: string, scope: string = bucket) {
    const [limit, window] = await Promise.all([
      this.registry.get(`identity.auth_rate.${bucket}_ip_limit`),
      this.registry.get("identity.auth_rate.ip_window_seconds"),
    ]);
    return this.repo.consume(this.key(`ip:${scope}`, ip), limit, window);
  }

  async consumeAccount(bucket: "login" | "forgot", email: string) {
    const [limit, window, gap] = await Promise.all([
      this.registry.get(`identity.auth_rate.${bucket}_account_limit`),
      this.registry.get("identity.auth_rate.account_window_seconds"),
      bucket === "forgot" ? this.registry.get("identity.auth_rate.forgot_send_gap_seconds") : 0,
    ]);
    return this.repo.consume(this.key(`account:${bucket}`, email.trim().toLowerCase()), limit, window, gap);
  }

  purgeExpired() { return this.repo.purgeExpired(); }

  private key(scope: string, value: string): string {
    return createHmac("sha256", this.env.getOrThrow<string>("AUTH_RATE_LIMIT_SECRET"))
      .update(`${scope}\0${value}`).digest("hex");
  }
}
