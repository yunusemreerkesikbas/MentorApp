import { randomBytes } from "node:crypto";
import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import type { AuthUser } from "@mentor/types";
import type {
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  SignupInput,
  VerifyEmailInput,
} from "@mentor/validation";
import { DomainError, UnauthorizedError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { Env } from "../../../config/env.validation";
import { EMAIL_PORT, type EmailPort } from "../../../shared/ports/email.port";
import {
  EmailTokenType,
  RESET_PASSWORD_TTL_MS,
  UserStatus,
  VERIFY_EMAIL_TTL_MS,
} from "../domain/identity.constants";
import { EmailTokenRepository } from "../infrastructure/email-token.repository";
import { UsersRepository, type UserRow } from "../infrastructure/users.repository";
import { hashToken, TokenService, type IssuedTokens } from "./token.service";
import { TurnstileService } from "./turnstile.service";

export interface AuthResult {
  user: AuthUser;
  tokens: IssuedTokens;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly emailTokenRepo: EmailTokenRepository,
    private readonly tokenService: TokenService,
    private readonly turnstile: TurnstileService,
    private readonly config: ConfigService<Env, true>,
    @Inject(EMAIL_PORT) private readonly email: EmailPort,
  ) {}

  async signup(input: SignupInput): Promise<AuthResult> {
    await this.turnstile.assertValid(input.turnstileToken);

    const existing = await this.usersRepo.findByEmailService(input.email);
    if (existing) {
      throw new DomainError(ErrorCode.AUTH_EMAIL_IN_USE, HttpStatus.CONFLICT);
    }

    const passwordHash = await argon2.hash(input.password);
    let user: UserRow;
    try {
      user = await this.usersRepo.createService({
        email: input.email,
        passwordHash,
        displayName: input.displayName,
        kvkkAcceptedAt: new Date(),
      });
    } catch (err) {
      // Check-then-insert race: a concurrent signup hit the unique index → same 409 code.
      if (isUniqueViolation(err)) {
        throw new DomainError(ErrorCode.AUTH_EMAIL_IN_USE, HttpStatus.CONFLICT);
      }
      throw err;
    }

    await this.sendEmailToken(user, EmailTokenType.VERIFY_EMAIL);
    const tokens = await this.tokenService.issue({
      id: user.id,
      roles: user.roles,
      organizationId: user.organizationId,
    });
    return { user: toAuthUser(user), tokens };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.usersRepo.findByEmailService(input.email);
    // Same generic 401 for unknown email AND wrong password (no user enumeration).
    if (!user) {
      // Burn comparable time so unknown-email doesn't answer faster (timing side-channel).
      await argon2.verify(DUMMY_HASH, input.password).catch(() => undefined);
      throw new DomainError(ErrorCode.AUTH_INVALID_CREDENTIALS, HttpStatus.UNAUTHORIZED);
    }
    const valid = await argon2.verify(user.passwordHash, input.password).catch(() => false);
    if (!valid) {
      throw new DomainError(ErrorCode.AUTH_INVALID_CREDENTIALS, HttpStatus.UNAUTHORIZED);
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new DomainError(ErrorCode.AUTH_ACCOUNT_SUSPENDED, HttpStatus.FORBIDDEN);
    }

    const tokens = await this.tokenService.issue({
      id: user.id,
      roles: user.roles,
      organizationId: user.organizationId,
    });
    return { user: toAuthUser(user), tokens };
  }

  async refresh(rawRefreshToken: string): Promise<AuthResult> {
    const { tokens, userId } = await this.tokenService.rotate(rawRefreshToken);
    const user = await this.usersRepo.findByIdService(userId);
    if (!user) throw new UnauthorizedError();
    return { user: toAuthUser(user), tokens };
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (rawRefreshToken) await this.tokenService.revokeByRawToken(rawRefreshToken);
    // Idempotent: missing/unknown cookie is still a successful logout.
  }

  async verifyEmail(input: VerifyEmailInput): Promise<void> {
    const row = await this.emailTokenRepo.consume(hashToken(input.token), EmailTokenType.VERIFY_EMAIL);
    if (!row) throw new DomainError(ErrorCode.AUTH_TOKEN_INVALID, HttpStatus.BAD_REQUEST);
    if (row.expiresAt.getTime() <= Date.now()) {
      throw new DomainError(ErrorCode.AUTH_TOKEN_EXPIRED, HttpStatus.BAD_REQUEST);
    }
    await this.usersRepo.updateService(row.userId, { emailVerifiedAt: new Date() });
  }

  /** Always resolves 200 — whether the email exists is never revealed. */
  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await this.usersRepo.findByEmailService(input.email);
    if (!user) return;
    await this.sendEmailToken(user, EmailTokenType.RESET_PASSWORD);
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const row = await this.emailTokenRepo.consume(hashToken(input.token), EmailTokenType.RESET_PASSWORD);
    if (!row) throw new DomainError(ErrorCode.AUTH_TOKEN_INVALID, HttpStatus.BAD_REQUEST);
    if (row.expiresAt.getTime() <= Date.now()) {
      throw new DomainError(ErrorCode.AUTH_TOKEN_EXPIRED, HttpStatus.BAD_REQUEST);
    }
    const passwordHash = await argon2.hash(input.password);
    await this.usersRepo.updateService(row.userId, { passwordHash });
    // Stolen-password assumption: kill every active session.
    await this.tokenService.revokeAllForUser(row.userId);
  }

  private async sendEmailToken(user: UserRow, type: EmailTokenType): Promise<void> {
    const raw = randomBytes(32).toString("base64url");
    const ttl = type === EmailTokenType.VERIFY_EMAIL ? VERIFY_EMAIL_TTL_MS : RESET_PASSWORD_TTL_MS;
    await this.emailTokenRepo.create({
      userId: user.id,
      type,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + ttl),
    });

    const appUrl = this.config.get("APP_URL", { infer: true });
    const path = type === EmailTokenType.VERIFY_EMAIL ? "eposta-dogrula" : "sifre-sifirla";
    try {
      await this.email.sendTransactional({
        to: user.email,
        template: type,
        variables: { displayName: user.displayName, link: `${appUrl}/${path}?token=${raw}` },
      });
    } catch (err) {
      // Email failures must not break signup/forgot flows; log + continue (W5 adds retries via queue).
      this.logger.error(`email send failed (${type}): ${String(err)}`);
    }
  }
}

function isUniqueViolation(err: unknown): boolean {
  // drizzle wraps the pg error; the SQLSTATE may sit on the error or its cause.
  const code =
    (err as { code?: string })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

/** Pre-computed argon2 hash of an unguessable value — used to equalize login timing. */
const DUMMY_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$RdescudvJCsgt3ub+b+dWRWJTmaaJObG";

export function toAuthUser(user: UserRow): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: user.roles as AuthUser["roles"],
    organizationId: user.organizationId,
    examType: (user.examType as AuthUser["examType"]) ?? null,
    examDate: user.examDate ?? null,
    emailVerified: user.emailVerifiedAt != null,
    createdAt: user.createdAt.toISOString(),
  };
}
