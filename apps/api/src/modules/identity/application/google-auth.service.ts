import { randomBytes } from "node:crypto";
import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { OAuth2Client } from "google-auth-library";
import type { AuthResult } from "./auth.service";
import { toAuthUser } from "./auth.service";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { isUniqueViolation } from "../../../common/errors/postgres-error";
import type { Env } from "../../../config/env.validation";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";
import {
  AuthProvider,
  GOOGLE_OAUTH_STATE_TTL_MS,
  UserStatus,
} from "../domain/identity.constants";
import { AuthAccountRepository } from "../infrastructure/auth-account.repository";
import { UsersRepository, type UserRow } from "../infrastructure/users.repository";
import { TokenService } from "./token.service";
import { GoogleLinkingService } from "./google-linking.service";
import { signGoogleOAuthState, verifyGoogleOAuthState, type GoogleOAuthState, type GoogleLinkState } from "./google-oauth-state";
export { signGoogleOAuthState, verifyGoogleOAuthState, type GoogleOAuthState } from "./google-oauth-state";

export interface GoogleOAuthProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
}

export interface GoogleOAuthStatus {
  enabled: boolean;
  flagEnabled: boolean;
  configured: boolean;
}

@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly configRegistry: ConfigRegistryService,
    private readonly usersRepo: UsersRepository,
    private readonly authAccounts: AuthAccountRepository,
    private readonly tokenService: TokenService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly linking: GoogleLinkingService,
  ) {}

  async createStartFor(input: {
    mode: "login" | "signup";
    locale: "tr" | "en";
    returnTo: string;
    kvkkAccepted: boolean;
  }): Promise<{ state: GoogleOAuthState; cookieValue: string; url: string }> {
    await this.assertEnabled();
    const state: GoogleOAuthState = {
      nonce: randomBytes(32).toString("base64url"),
      mode: input.mode,
      locale: input.locale,
      returnTo: sanitizeReturnTo(input.returnTo),
      kvkkAccepted: input.kvkkAccepted,
      expiresAt: Date.now() + GOOGLE_OAUTH_STATE_TTL_MS,
    };
    return this.createLinkStartFor(state);
  }

  async createLinkStartFor(state: GoogleOAuthState): Promise<{ state: GoogleOAuthState; cookieValue: string; url: string }> {
    await this.assertEnabled();
    const client = this.client();
    return {
      state,
      cookieValue: signGoogleOAuthState(state, this.stateSecret()),
      url: client.generateAuthUrl({
        scope: ["openid", "email", "profile"],
        state: state.nonce,
        prompt: "select_account",
        include_granted_scopes: false,
      }),
    };
  }

  async status(): Promise<GoogleOAuthStatus> {
    const flagEnabled = await this.configRegistry.get(FeatureFlag.GOOGLE_OAUTH_ENABLED);
    const configured = this.hasCredentials();
    return { enabled: flagEnabled && configured, flagEnabled, configured };
  }

  verifyState(cookieValue: string | undefined, stateNonce: string): GoogleOAuthState {
    const state = verifyGoogleOAuthState(cookieValue, this.stateSecret());
    if (!state || state.nonce !== stateNonce || state.expiresAt <= Date.now()) {
      throw new DomainError(ErrorCode.AUTH_GOOGLE_STATE_INVALID, HttpStatus.BAD_REQUEST);
    }
    return state;
  }

  async callback(code: string, state: GoogleOAuthState): Promise<AuthResult> {
    await this.assertEnabled();
    if (state.mode === "link") {
      throw new DomainError(ErrorCode.AUTH_GOOGLE_STATE_INVALID, HttpStatus.BAD_REQUEST);
    }
    const profile = await this.exchangeCode(code);
    if (!profile.emailVerified) {
      throw new DomainError(ErrorCode.AUTH_GOOGLE_EMAIL_UNVERIFIED, HttpStatus.FORBIDDEN);
    }

    const linked = await this.authAccounts.findByProviderSubject(
      AuthProvider.GOOGLE,
      profile.sub,
    );
    if (linked) {
      const user = await this.requireActiveUser(linked.userId);
      return this.issue(user);
    }

    const existing = await this.usersRepo.findByEmailService(profile.email);
    if (existing) {
      throw new DomainError(ErrorCode.AUTH_GOOGLE_LINK_REQUIRED, HttpStatus.CONFLICT);
    }

    if (state.mode !== "signup" || !state.kvkkAccepted) {
      throw new DomainError(ErrorCode.AUTH_GOOGLE_ACCOUNT_NOT_FOUND, HttpStatus.UNAUTHORIZED);
    }

    const passwordHash = await argon2.hash(randomBytes(32).toString("base64url"));
    let user: UserRow;
    try {
      user = await this.usersRepo.createService({
        email: profile.email,
        passwordHash,
        displayName: profile.displayName,
        emailVerifiedAt: new Date(),
        kvkkAcceptedAt: new Date(),
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const raced = await this.usersRepo.findByEmailService(profile.email);
      if (!raced) throw err;
      throw new DomainError(ErrorCode.AUTH_GOOGLE_LINK_REQUIRED, HttpStatus.CONFLICT);
    }
    await this.linkGoogle(user.id, profile);
    return this.issue(user);
  }

  async linkCallback(code: string, state: GoogleLinkState): Promise<void> {
    await this.assertEnabled();
    await this.linking.complete(state, () => this.exchangeCode(code));
  }

  redirectUrl(state: GoogleOAuthState, user: UserRow | AuthResult["user"]): string {
    const appUrl = this.config.get("APP_URL", { infer: true }).replace(/\/$/, "");
    const destination =
      user.username && user.examType
        ? sanitizeReturnTo(state.returnTo)
        : state.locale === "tr"
          ? "/baslangic"
          : "/en/onboarding";
    return `${appUrl}${destination}`;
  }

  private async exchangeCode(code: string): Promise<GoogleOAuthProfile> {
    const credentials = this.credentials();
    const client = this.client(credentials);
    try {
      const { tokens } = await client.getToken(code);
      if (!tokens.id_token) {
        throw new DomainError(ErrorCode.AUTH_GOOGLE_STATE_INVALID, HttpStatus.BAD_REQUEST);
      }
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: credentials.clientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        throw new DomainError(ErrorCode.AUTH_GOOGLE_STATE_INVALID, HttpStatus.BAD_REQUEST);
      }
      return {
        sub: payload.sub,
        email: payload.email.toLowerCase(),
        emailVerified: payload.email_verified === true,
        displayName: displayNameFromGoogle(payload.name, payload.email),
      };
    } catch (err) {
      if (err instanceof DomainError) throw err;
      throw new DomainError(ErrorCode.AUTH_GOOGLE_STATE_INVALID, HttpStatus.BAD_REQUEST);
    }
  }

  private client(credentials = this.credentials()): OAuth2Client {
    return new OAuth2Client(
      credentials.clientId,
      credentials.clientSecret,
      credentials.redirectUri,
    );
  }

  private credentials(): {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  } {
    const clientId = this.config.get("GOOGLE_OAUTH_CLIENT_ID", { infer: true });
    const clientSecret = this.config.get("GOOGLE_OAUTH_CLIENT_SECRET", { infer: true });
    const redirectUri = this.config.get("GOOGLE_OAUTH_REDIRECT_URI", { infer: true });
    if (!clientId || !clientSecret || !redirectUri) {
      throw new DomainError(
        ErrorCode.AUTH_GOOGLE_UNAVAILABLE,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { clientId, clientSecret, redirectUri };
  }

  private hasCredentials(): boolean {
    return Boolean(
      this.config.get("GOOGLE_OAUTH_CLIENT_ID", { infer: true }) &&
        this.config.get("GOOGLE_OAUTH_CLIENT_SECRET", { infer: true }) &&
        this.config.get("GOOGLE_OAUTH_REDIRECT_URI", { infer: true }),
    );
  }

  private async assertEnabled(): Promise<void> {
    if (!(await this.configRegistry.get(FeatureFlag.GOOGLE_OAUTH_ENABLED))) {
      throw new DomainError(
        ErrorCode.AUTH_GOOGLE_UNAVAILABLE,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private stateSecret(): string {
    return this.config.get("JWT_ACCESS_SECRET", { infer: true });
  }

  private async requireActiveUser(userId: string): Promise<UserRow> {
    const user = await this.usersRepo.findByIdService(userId);
    if (!user) throw new DomainError(ErrorCode.AUTH_GOOGLE_ACCOUNT_NOT_FOUND, HttpStatus.UNAUTHORIZED);
    if (user.status !== UserStatus.ACTIVE) {
      throw new DomainError(ErrorCode.AUTH_ACCOUNT_SUSPENDED, HttpStatus.FORBIDDEN);
    }
    return user;
  }

  private async linkGoogle(userId: string, profile: GoogleOAuthProfile): Promise<void> {
    try {
      await this.authAccounts.create({
        userId,
        provider: AuthProvider.GOOGLE,
        providerSubject: profile.sub,
        providerEmail: profile.email,
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const [sameSubject, sameUser] = await Promise.all([
        this.authAccounts.findByProviderSubject(AuthProvider.GOOGLE, profile.sub),
        this.authAccounts.findByUserProvider(userId, AuthProvider.GOOGLE),
      ]);
      if (
        sameSubject?.userId === userId &&
        sameUser?.providerSubject === profile.sub
      ) {
        return;
      }
      throw new DomainError(ErrorCode.AUTH_GOOGLE_ACCOUNT_NOT_FOUND, HttpStatus.UNAUTHORIZED);
    }
  }

  private async issue(user: UserRow): Promise<AuthResult> {
    const tokens = await this.tokenService.issue({
      id: user.id,
      roles: user.roles,
      organizationId: user.organizationId,
    });
    return { user: toAuthUser(user, this.storage), tokens };
  }
}

function sanitizeReturnTo(value: string): string {
  return /^\/(?!\/)[a-z0-9/_-]*$/i.test(value) ? value : "/dashboard";
}

function displayNameFromGoogle(name: string | undefined, email: string): string {
  const value = (name ?? email.split("@")[0] ?? "Mentor").trim().slice(0, 64);
  return value.length >= 2 ? value : "Mentor";
}
