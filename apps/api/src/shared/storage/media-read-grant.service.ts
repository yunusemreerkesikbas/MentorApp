import { Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env.validation";
import { UnauthorizedError } from "../../common/errors/domain-error";
import type { StorageReadActor } from "./storage-budget.types";
import { CONFIG_CATALOG } from "../../common/config/config.catalog";
import { isPrivateKey, isPublicKey } from "./storage-prefixes";
import { validateStorageOperation } from "./storage-budget.validation";

const claimsSchema = z
  .object({
    v: z.literal(1),
    key: z.string().max(512),
    userId: z.string().uuid(),
    sessionId: z.string().uuid(),
    expiresAt: z.number().int().positive(),
  })
  .strict();

export interface MediaReadGrant extends StorageReadActor {
  key: string;
  expiresAt: number;
}
@Injectable()
export class MediaReadGrantService {
  constructor(private readonly config: ConfigService<Env, true>) {}
  issue(key: string, actor: StorageReadActor, ttlSeconds: number): string {
    if (
      !CONFIG_CATALOG["storage.media.read_seconds"].schema.safeParse(ttlSeconds)
        .success
    )
      throw new UnauthorizedError();
    const claims = claimsSchema.safeParse({
      v: 1,
      key,
      ...actor,
      expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds,
    });
    if (!claims.success) throw new UnauthorizedError();
    this.assertOwnerKey(key, actor.userId);
    const payload = Buffer.from(JSON.stringify(claims.data)).toString(
      "base64url",
    );
    return `${payload}.${this.signature(payload).toString("base64url")}`;
  }
  verify(token: string): MediaReadGrant {
    try {
      if (
        typeof token !== "string" ||
        token.length > 2048 ||
        !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)
      )
        throw new UnauthorizedError();
      const [payload, signature] = token.split(".") as [string, string];
      const supplied = Buffer.from(signature, "base64url");
      const expected = this.signature(payload);
      if (
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      )
        throw new UnauthorizedError();
      const claims = claimsSchema.parse(
        JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
      );
      const remaining = claims.expiresAt - Math.floor(Date.now() / 1000);
      if (
        remaining <= 0 ||
        remaining > CONFIG_CATALOG["storage.media.read_seconds"].default
      )
        throw new UnauthorizedError();
      this.assertOwnerKey(claims.key, claims.userId);
      const { v: _version, ...grant } = claims;
      return grant;
    } catch {
      throw new UnauthorizedError();
    }
  }
  publicUrl(key: string): string {
    validateStorageOperation({ kind: "read", key });
    if (!isPublicKey(key)) throw new UnauthorizedError();
    return `${this.config.getOrThrow("R2_PUBLIC_BASE_URL", { infer: true })}/${key}`;
  }
  privateUrl(grant: string): string {
    const base = new URL(
      this.config.getOrThrow("R2_PUBLIC_BASE_URL", { infer: true }),
    );
    base.pathname = "/v1/storage/media/private";
    base.searchParams.set("grant", grant);
    return base.toString();
  }
  private signature(payload: string): Buffer {
    return createHmac(
      "sha256",
      this.config.getOrThrow("MEDIA_READ_SECRET", { infer: true }),
    )
      .update(payload)
      .digest();
  }
  private assertOwnerKey(key: string, owner: string): void {
    try {
      validateStorageOperation({ kind: "read", key });
    } catch {
      throw new UnauthorizedError();
    }
    if (
      !isPrivateKey(key) ||
      key.split("/").length !== 3 ||
      key.split("/")[1] !== owner
    )
      throw new UnauthorizedError();
  }
}
