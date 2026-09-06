import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { Env } from "../../config/env.validation";

export interface CloudflareAccessIdentity {
  email: string;
}

export const CLOUDFLARE_ACCESS_KEY_SET_FACTORY = Symbol(
  "CLOUDFLARE_ACCESS_KEY_SET_FACTORY",
);
export type CloudflareAccessKeySetFactory = (url: URL) => JWTVerifyGetKey;

/** Cryptographically verifies Access assertions; it never trusts forwarded identity headers. */
@Injectable()
export class CloudflareAccessVerifier {
  private keySet: JWTVerifyGetKey | null = null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    @Optional()
    @Inject(CLOUDFLARE_ACCESS_KEY_SET_FACTORY)
    private readonly keySetFactory?: CloudflareAccessKeySetFactory,
  ) {}

  async verify(assertion: string): Promise<CloudflareAccessIdentity> {
    const issuer = this.config
      .get("CLOUDFLARE_ACCESS_TEAM_DOMAIN", { infer: true })!
      .replace(/\/$/, "");
    const audience = this.config
      .get("CLOUDFLARE_ACCESS_AUD", { infer: true })!
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    this.keySet ??=
      this.keySetFactory?.(new URL(`${issuer}/cdn-cgi/access/certs`)) ??
      createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
        timeoutDuration: 5_000,
        cooldownDuration: 30_000,
      });
    const { payload } = await jwtVerify(assertion, this.keySet, {
      issuer,
      audience,
      algorithms: ["RS256"],
      clockTolerance: 5,
    });
    if (typeof payload.email !== "string" || !payload.email.includes("@")) {
      throw new Error("Cloudflare Access assertion has no email identity");
    }
    return { email: payload.email.trim().toLowerCase() };
  }
}
