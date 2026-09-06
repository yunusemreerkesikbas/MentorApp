import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UnauthorizedError } from "../../../common/errors/domain-error";
import type { RequestUser } from "../../../common/auth/current-user";
import type { Env } from "../../../config/env.validation";
import type { AccessTokenPayload } from "../domain/identity.constants";
import { AuthSessionRepository } from "../infrastructure/auth-session.repository";

export interface IssuedTokens {
  accessToken: string;
  expiresIn: number;
  /** Raw refresh secret goes ONLY into the httpOnly cookie. */
  refreshToken: string;
  refreshExpiresAt: Date;
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly sessions: AuthSessionRepository,
  ) {}

  async issue(user: { id: string; roles: string[]; organizationId: string | null }, expectedPasswordHash?: string): Promise<IssuedTokens> {
    const refresh = this.newRefresh();
    const principal = await this.sessions.create(user.id, randomUUID(), refresh.record, expectedPasswordHash);
    if (!principal) throw new UnauthorizedError();
    return this.sign(principal, refresh);
  }

  async rotate(rawRefreshToken: string): Promise<{ tokens: IssuedTokens; userId: string }> {
    const refresh = this.newRefresh();
    const principal = await this.sessions.rotate(hashToken(rawRefreshToken), refresh.record);
    if (!principal) throw new UnauthorizedError();
    return { tokens: await this.sign(principal, refresh), userId: principal.id };
  }

  async validateSession(sessionId: string, userId?: string): Promise<RequestUser> {
    const principal = await this.sessions.findActive(sessionId, userId);
    if (!principal) throw new UnauthorizedError();
    return principal;
  }

  revokeByRawToken(rawRefreshToken: string): Promise<void> {
    return this.sessions.revokeByTokenHash(hashToken(rawRefreshToken));
  }

  revokeAllForUser(userId: string): Promise<void> {
    return this.sessions.revokeAllForUser(userId);
  }

  resetPassword(tokenHash: string, passwordHash: string) {
    return this.sessions.resetPassword(tokenHash, passwordHash);
  }

  private newRefresh() {
    const raw = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + this.config.get("JWT_REFRESH_TTL", { infer: true }) * 1000);
    return { raw, record: { tokenHash: hashToken(raw), expiresAt } };
  }

  private async sign(principal: RequestUser, refresh: ReturnType<TokenService["newRefresh"]>): Promise<IssuedTokens> {
    const expiresIn = this.config.get("JWT_ACCESS_TTL", { infer: true });
    const payload: AccessTokenPayload = {
      sub: principal.id, sid: principal.sessionId, roles: principal.roles, orgId: principal.orgId,
    };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn, algorithm: "HS256" });
    return { accessToken, expiresIn, refreshToken: refresh.raw, refreshExpiresAt: refresh.record.expiresAt };
  }
}
