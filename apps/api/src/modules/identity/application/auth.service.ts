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
import { isUniqueViolation } from "../../../common/errors/postgres-error";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import type { Env } from "../../../config/env.validation";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../../../shared/ports/job-queue.port";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";
import { EmailTemplate, JobName } from "../../../shared/notifications/constants";
import {
  EmailTokenType,
  RESET_PASSWORD_TTL_MS,
  UserStatus,
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
    private readonly configRegistry: ConfigRegistryService,
    @Inject(JOB_QUEUE_PORT) private readonly queue: JobQueuePort,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
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
        username: input.username,
        kvkkAcceptedAt: new Date(),
      });
    } catch (err) {
      // Check-then-insert race: a concurrent signup hit the unique index → same 409 code.
      if (isUniqueViolation(err)) {
        if (uniqueConstraint(err)?.includes("username")) {
          throw new DomainError(ErrorCode.AUTH_USERNAME_IN_USE, HttpStatus.CONFLICT);
        }
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
    return { user: toAuthUser(user, this.storage), tokens };
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
    return { user: toAuthUser(user, this.storage), tokens };
  }

  async refresh(rawRefreshToken: string): Promise<AuthResult> {
    const { tokens, userId } = await this.tokenService.rotate(rawRefreshToken);
    const user = await this.usersRepo.findByIdService(userId);
    if (!user) throw new UnauthorizedError();
    return { user: toAuthUser(user, this.storage), tokens };
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

  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await this.usersRepo.findByIdService(userId);
    if (!user) throw new UnauthorizedError();
    if (user.emailVerifiedAt) return;

    const [limit, windowSeconds] = await Promise.all([
      this.configRegistry.get("identity.verification_email.resend_limit"),
      this.configRegistry.get("identity.verification_email.resend_window_seconds"),
    ]);
    const since = new Date(Date.now() - windowSeconds * 1000);
    const attempts =
      await this.emailTokenRepo.countVerificationResendAttemptsSince(
        user.id,
        since,
      );
    if (attempts >= limit) {
      throw new DomainError(
        ErrorCode.AUTH_VERIFICATION_EMAIL_RATE_LIMITED,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.emailTokenRepo.createVerificationResendAttempt(user.id);
    await this.sendEmailToken(user, EmailTokenType.VERIFY_EMAIL);
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
    const ttl =
      type === EmailTokenType.VERIFY_EMAIL
        ? (await this.configRegistry.get(
            "identity.verification_email.token_ttl_seconds",
          )) * 1000
        : RESET_PASSWORD_TTL_MS;
    await this.emailTokenRepo.create({
      userId: user.id,
      type,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + ttl),
    });

    const appUrl = this.config.get("APP_URL", { infer: true });
    const path = type === EmailTokenType.VERIFY_EMAIL ? "eposta-dogrula" : "sifre-sifirla";
    const template =
      type === EmailTokenType.VERIFY_EMAIL
        ? EmailTemplate.VERIFY_EMAIL
        : EmailTemplate.RESET_PASSWORD;
    try {
      await this.queue.enqueue(JobName.SEND_EMAIL, {
        to: user.email,
        template,
        variables: { displayName: user.displayName, link: `${appUrl}/${path}?token=${raw}` },
      });
    } catch (err) {
      this.logger.error(`email enqueue failed (${type}): ${String(err)}`);
    }
  }
}

/** Pre-computed argon2 hash of an unguessable value — used to equalize login timing. */
const DUMMY_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$RdescudvJCsgt3ub+b+dWRWJTmaaJObG";

function uniqueConstraint(err: unknown): string | undefined {
  return (
    (err as { constraint?: string })?.constraint ??
    (err as { cause?: { constraint?: string } })?.cause?.constraint
  );
}

export function toAuthUser(
  user: UserRow,
  storage?: Pick<StoragePort, "getPublicUrl">,
): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    username: user.username ?? null,
    avatarUrl:
      user.avatarStorageKey && storage ? storage.getPublicUrl(user.avatarStorageKey) : null,
    bio: user.bio ?? null,
    website: user.website ?? null,
    roles: user.roles as AuthUser["roles"],
    organizationId: user.organizationId,
    examType: (user.examType as AuthUser["examType"]) ?? null,
    examDate: user.examDate ?? null,
    dailyFocusGoalMinutes: user.dailyFocusGoalMinutes ?? null,
    emailVerified: user.emailVerifiedAt != null,
    createdAt: user.createdAt.toISOString(),
  };
}
