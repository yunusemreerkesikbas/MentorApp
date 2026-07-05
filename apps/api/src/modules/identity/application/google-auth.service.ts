import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
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

export interface GoogleOAuthState {
  nonce: string;
  mode: "login" | "signup";
  locale: "tr" | "en";
  returnTo: string;
  kvkkAccepted: boolean;
  expiresAt: number;
}

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
  ) {}

  async createStartFor(input: {
    mode: "login" | "signup";
    locale: "tr" | "en";
    returnTo: string;
    kvkkAccepted: boolean;
  }): Promise<{ state: GoogleOAuthState; cookieValue: string; url: string }> {
    await this.assertEnabled();
    const client = this.client();
    const state: GoogleOAuthState = {
      nonce: randomBytes(32).toString("base64url"),
      mode: input.mode,
      locale: input.locale,
      returnTo: sanitizeReturnTo(input.returnTo),
      kvkkAccepted: input.kvkkAccepted,
      expiresAt: Date.now() + GOOGLE_OAUTH_STATE_TTL_MS,
    };
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
      if (existing.status !== UserStatus.ACTIVE) {
        throw new DomainError(ErrorCode.AUTH_ACCOUNT_SUSPENDED, HttpStatus.FORBIDDEN);
      }
      const user = existing.emailVerifiedAt
        ? existing
        : ((await this.usersRepo.updateService(existing.id, {
            emailVerifiedAt: new Date(),
          })) ?? existing);
      await this.linkGoogle(existing.id, profile);
      return this.issue(user);
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
      if (raced.status !== UserStatus.ACTIVE) {
        throw new DomainError(ErrorCode.AUTH_ACCOUNT_SUSPENDED, HttpStatus.FORBIDDEN);
      }
      const user = raced.emailVerifiedAt
        ? raced
        : ((await this.usersRepo.updateService(raced.id, {
            emailVerifiedAt: new Date(),
          })) ?? raced);
      await this.linkGoogle(raced.id, profile);
      return this.issue(user);
    }
    await this.linkGoogle(user.id, profile);
    return this.issue(user);
  }

  redirectUrl(state: GoogleOAuthState, user: UserRow | AuthResult["user"]): string {
    const appUrl = this.config.get("APP_URL", { infer: true }).replace(/\/$/, "");
    const destination =
      user.username && user.examType ? sanitizeReturnTo(state.returnTo) : "/onboarding";
    return `${appUrl}/${state.locale}${destination}`;
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

export function signGoogleOAuthState(state: GoogleOAuthState, secret: string): string {
  const body = Buffer.from(JSON.stringify(state)).toString("base64url");
  const sig = hmac(body, secret);
  return `${body}.${sig}`;
}

export function verifyGoogleOAuthState(
  cookieValue: string | undefined,
  secret: string,
): GoogleOAuthState | null {
  if (!cookieValue) return null;
  const [body, sig] = cookieValue.split(".");
  if (!body || !sig) return null;
  const expected = hmac(body, secret);
  if (!safeEqual(sig, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as GoogleOAuthState;
  } catch {
    return null;
  }
}

function hmac(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function sanitizeReturnTo(value: string): string {
  return /^\/(?!\/)[a-z0-9/_-]*$/i.test(value) ? value : "/panel";
}

function displayNameFromGoogle(name: string | undefined, email: string): string {
  const value = (name ?? email.split("@")[0] ?? "Mentor").trim().slice(0, 64);
  return value.length >= 2 ? value : "Mentor";
}
