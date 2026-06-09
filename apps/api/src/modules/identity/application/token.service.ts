import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UnauthorizedError } from "../../../common/errors/domain-error";
import type { Env } from "../../../config/env.validation";
import type { AccessTokenPayload } from "../domain/identity.constants";
import { RefreshTokenRepository } from "../infrastructure/refresh-token.repository";
import { UsersRepository } from "../infrastructure/users.repository";

export interface IssuedTokens {
  accessToken: string;
  expiresIn: number;
  /** Raw refresh secret — goes ONLY into the httpOnly cookie, never into a payload. */
  refreshToken: string;
  refreshExpiresAt: Date;
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Access JWT (short-lived) + opaque refresh token (random 256-bit, hash-stored)
 * with rotation and reuse detection (family revoke on replay — theft assumption).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly refreshRepo: RefreshTokenRepository,
    private readonly usersRepo: UsersRepository,
  ) {}

  async issue(user: { id: string; roles: string[]; organizationId: string | null }): Promise<IssuedTokens> {
    return this.issueInFamily(user, randomUUID());
  }

  /**
   * Rotate: validate the presented refresh token, revoke it, issue a new pair in the same family.
   * Reuse (already-revoked token presented) or expiry → revoke the whole family + 401.
   */
  async rotate(rawRefreshToken: string): Promise<{ tokens: IssuedTokens; userId: string }> {
    const row = await this.refreshRepo.findByHash(hashToken(rawRefreshToken));
    if (!row) throw new UnauthorizedError();

    if (row.revokedAt) {
      // Replay of a rotated token → assume theft, kill every descendant.
      await this.refreshRepo.revokeFamily(row.familyId);
      throw new UnauthorizedError();
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.refreshRepo.revokeFamily(row.familyId);
      throw new UnauthorizedError();
    }

    const revoked = await this.refreshRepo.revokeById(row.id);
    if (!revoked) {
      // Lost the race against a parallel rotation → same replay treatment.
      await this.refreshRepo.revokeFamily(row.familyId);
      throw new UnauthorizedError();
    }

    const user = await this.loadPrincipal(row.userId);
    const tokens = await this.issueInFamily(user, row.familyId);
    return { tokens, userId: row.userId };
  }

  async revokeByRawToken(rawRefreshToken: string): Promise<void> {
    const row = await this.refreshRepo.findByHash(hashToken(rawRefreshToken));
    if (row && !row.revokedAt) await this.refreshRepo.revokeById(row.id);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshRepo.revokeAllForUser(userId);
  }

  private async issueInFamily(
    user: { id: string; roles: string[]; organizationId: string | null },
    familyId: string,
  ): Promise<IssuedTokens> {
    const accessTtl = this.config.get("JWT_ACCESS_TTL", { infer: true });
    const refreshTtl = this.config.get("JWT_REFRESH_TTL", { infer: true });

    const payload: AccessTokenPayload = { sub: user.id, roles: user.roles, orgId: user.organizationId };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: accessTtl });

    const refreshToken = randomBytes(32).toString("base64url");
    const refreshExpiresAt = new Date(Date.now() + refreshTtl * 1000);
    await this.refreshRepo.create({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      familyId,
      expiresAt: refreshExpiresAt,
    });

    return { accessToken, expiresIn: accessTtl, refreshToken, refreshExpiresAt };
  }

  private async loadPrincipal(
    userId: string,
  ): Promise<{ id: string; roles: string[]; organizationId: string | null }> {
    const user = await this.usersRepo.findByIdService(userId);
    // Token row exists but the user is gone/suspended → deny.
    if (!user || user.status !== "ACTIVE") throw new UnauthorizedError();
    return { id: user.id, roles: user.roles, organizationId: user.organizationId };
  }
}
