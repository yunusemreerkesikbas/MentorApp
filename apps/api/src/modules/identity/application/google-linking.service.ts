import { createHash, randomBytes } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import type { GoogleLinkStartInput } from "@mentor/validation";
import type { RequestUser } from "../../../common/auth/current-user";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { isUniqueViolation } from "../../../common/errors/postgres-error";
import { AuthProvider, UserStatus } from "../domain/identity.constants";
import { AuthAccountRepository } from "../infrastructure/auth-account.repository";
import { GoogleLinkingRepository } from "../infrastructure/google-linking.repository";
import { UsersRepository } from "../infrastructure/users.repository";
import type { GoogleOAuthProfile } from "./google-auth.service";
import type { GoogleLinkState } from "./google-oauth-state";
import { TokenService } from "./token.service";

/** Password-confirmation proof expires quickly and can only be consumed once. */
export const GOOGLE_LINK_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class GoogleLinkingService {
  constructor(
    private readonly users: UsersRepository,
    private readonly accounts: AuthAccountRepository,
    private readonly intents: GoogleLinkingRepository,
    private readonly tokens: TokenService,
  ) {}

  async status(userId: string) {
    const [user, account] = await Promise.all([
      this.users.findByIdService(userId),
      this.accounts.findByUserProvider(userId, AuthProvider.GOOGLE),
    ]);
    return {
      linked: Boolean(account),
      providerEmail: account?.providerEmail ?? null,
      canLink: Boolean(user?.emailVerifiedAt && user.status === UserStatus.ACTIVE && !account),
    };
  }

  async start(principal: RequestUser, input: GoogleLinkStartInput): Promise<GoogleLinkState> {
    const user = await this.users.findByIdService(principal.id);
    if (!user || user.status !== UserStatus.ACTIVE || !user.emailVerifiedAt) {
      throw new DomainError(ErrorCode.AUTH_GOOGLE_LINK_UNAVAILABLE, HttpStatus.FORBIDDEN);
    }
    if (!(await argon2.verify(user.passwordHash, input.password))) {
      throw new DomainError(ErrorCode.AUTH_INVALID_CREDENTIALS, HttpStatus.UNAUTHORIZED);
    }
    await this.tokens.validateSession(principal.sessionId, principal.id);
    if (await this.accounts.findByUserProvider(user.id, AuthProvider.GOOGLE)) {
      throw new DomainError(ErrorCode.AUTH_GOOGLE_LINK_CONFLICT, HttpStatus.CONFLICT);
    }
    const state: GoogleLinkState = {
      mode: "link",
      nonce: randomBytes(32).toString("base64url"),
      userId: user.id,
      sessionId: principal.sessionId,
      locale: input.locale,
      returnTo: input.locale === "tr" ? "/ayarlar" : "/en/settings",
      expiresAt: Date.now() + GOOGLE_LINK_TTL_MS,
    };
    await this.intents.create({
      userId: state.userId, sessionId: state.sessionId,
      nonceHash: hashNonce(state.nonce), expiresAt: new Date(state.expiresAt),
    });
    return state;
  }

  async complete(state: GoogleLinkState, profileLoader: () => Promise<GoogleOAuthProfile>): Promise<void> {
    if (state.expiresAt <= Date.now() ||
        !(await this.intents.consume(hashNonce(state.nonce), state.userId, state.sessionId))) {
      throw new DomainError(ErrorCode.AUTH_GOOGLE_STATE_INVALID, HttpStatus.BAD_REQUEST);
    }
    await this.tokens.validateSession(state.sessionId, state.userId);
    const profile = await profileLoader();
    const user = await this.users.findByIdService(state.userId);
    if (!profile.emailVerified || !user?.emailVerifiedAt ||
        user.status !== UserStatus.ACTIVE || user.email.toLowerCase() !== profile.email.toLowerCase()) {
      throw new DomainError(ErrorCode.AUTH_GOOGLE_LINK_EMAIL_MISMATCH, HttpStatus.FORBIDDEN);
    }
    const [subject, account] = await Promise.all([
      this.accounts.findByProviderSubject(AuthProvider.GOOGLE, profile.sub),
      this.accounts.findByUserProvider(state.userId, AuthProvider.GOOGLE),
    ]);
    if (subject || account) {
      throw new DomainError(ErrorCode.AUTH_GOOGLE_LINK_CONFLICT, HttpStatus.CONFLICT);
    }
    try {
      const linked = await this.intents.linkActiveSession({
        userId: state.userId, sessionId: state.sessionId,
        providerSubject: profile.sub, providerEmail: profile.email,
      });
      if (!linked) throw new DomainError(ErrorCode.AUTH_GOOGLE_LINK_UNAVAILABLE, HttpStatus.FORBIDDEN);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      throw new DomainError(ErrorCode.AUTH_GOOGLE_LINK_CONFLICT, HttpStatus.CONFLICT);
    }
  }
}

function hashNonce(nonce: string): string {
  return createHash("sha256").update(nonce).digest("hex");
}
