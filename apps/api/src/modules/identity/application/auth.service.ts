import { randomBytes } from "node:crypto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { IdentityEventTopic } from "../domain/identity.events";
import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { ADMIN_PANEL_ROLES, UserRole, type AuthUser } from "@mentor/types";
import type {
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  SignupInput,
  VerifyEmailInput,
} from "@mentor/validation";
import { DomainError, UnauthorizedError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { isUniqueViolation, uniqueConstraint } from "../../../common/errors/postgres-error";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import type { Env } from "../../../config/env.validation";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../../../shared/ports/job-queue.port";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";
import { EmailTemplate, JobName } from "../../../shared/notifications/constants";
import {
  EmailTokenType,
  CURRENT_TERMS_VERSION,
  RESET_PASSWORD_TTL_MS,
  UserStatus,
} from "../domain/identity.constants";
import { EmailTokenRepository } from "../infrastructure/email-token.repository";
import { UsersRepository, type UserRow } from "../infrastructure/users.repository";
import { hashToken, TokenService, type IssuedTokens } from "./token.service";
import { TurnstileService } from "./turnstile.service";
import { AuthRateLimitService } from "./auth-rate-limit.service";

export interface AuthResult {
  user: AuthUser;
  tokens: IssuedTokens;
}

export interface CoachSignupStatus {
  open: boolean;
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
    private readonly events: EventEmitter2,
    private readonly rates: AuthRateLimitService,
  ) {}

  async signup(input: SignupInput): Promise<AuthResult> {
    await this.turnstile.assertValid(input.turnstileToken);

    // A shut intake must not mint half a coach: COACH without the registry row that
    // `POST /v1/mentorship/coach-registration` refuses to write, stuck on the last onboarding step.
    if (input.intent === "COACH" && !(await this.coachSignupStatus()).open) {
      throw new DomainError(ErrorCode.MENTORSHIP_APPLICATIONS_CLOSED, HttpStatus.FORBIDDEN);
    }

    const existing = await this.usersRepo.findByEmailService(input.email);
    if (existing) {
      throw new DomainError(ErrorCode.AUTH_EMAIL_IN_USE, HttpStatus.CONFLICT);
    }

    const passwordHash = await argon2.hash(input.password);
    let user: UserRow;
    try {
      const acceptedAt = new Date();
      user = await this.usersRepo.createService({
        email: input.email,
        passwordHash,
        displayName: input.displayName,
        username: input.username,
        kvkkAcceptedAt: acceptedAt,
        termsAcceptedAt: acceptedAt,
        termsVersion: CURRENT_TERMS_VERSION,
        ageEligibilityConfirmedAt: acceptedAt,
        // The ONE role a client may ask for at signup (APP-089), and it is safe because COACH on
        // its own opens nothing: every road to a student's data runs through an invite code, and
        // the code needs a verified email plus an ACTIVE registry row that only
        // `POST /v1/mentorship/coach-registration` writes. What this buys is the coach-shaped
        // onboarding and home surface, which is what a coach shoved through the student wizard
        // could not have. Omitting `roles` entirely keeps the column default for everyone else.
        ...(input.intent === "COACH"
          ? { roles: [UserRole.STUDENT, UserRole.COACH] }
          : {}),
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

  /**
   * Whether a coach may sign up right now. Read by the unauthenticated signup screen so it can say
   * "closed" before the form is filled, instead of discovering it from a refused submission.
   */
  async coachSignupStatus(): Promise<CoachSignupStatus> {
    return { open: await this.configRegistry.get(FeatureFlag.MENTORSHIP_APPLICATIONS_OPEN) };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    await this.turnstile.assertValid(input.turnstileToken, "login");
    return this.loginWithRoleGate(input, false);
  }

  async loginAdmin(input: LoginInput, accessEmail?: string): Promise<AuthResult> {
    this.assertAccessEmail(input.email, accessEmail);
    return this.loginWithRoleGate(input, true);
  }

  private async loginWithRoleGate(input: LoginInput, requireAdmin: boolean): Promise<AuthResult> {
    const quota = await this.rates.consumeAccount("login", input.email);
    if (!quota.allowed) throw new DomainError(ErrorCode.TOO_MANY_REQUESTS, HttpStatus.TOO_MANY_REQUESTS, { retryAfter: quota.retryAfter });
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
    if (requireAdmin && !hasAdminPanelRole(user.roles)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }

    const tokens = await this.tokenService.issue({
      id: user.id,
      roles: user.roles,
      organizationId: user.organizationId,
    }, user.passwordHash, user.email);
    return { user: toAuthUser(user, this.storage), tokens };
  }

  async refresh(rawRefreshToken: string): Promise<AuthResult> {
    const { tokens, userId } = await this.tokenService.rotate(rawRefreshToken);
    const user = await this.usersRepo.findByIdService(userId);
    if (!user) throw new UnauthorizedError();
    return { user: toAuthUser(user, this.storage), tokens };
  }

  async refreshAdmin(rawRefreshToken: string, accessEmail?: string): Promise<AuthResult> {
    if (this.config.get("NODE_ENV", { infer: true }) === "production" && !accessEmail) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    const result = await this.refresh(rawRefreshToken);
    if (!hasAdminPanelRole(result.user.roles) || (accessEmail !== undefined &&
        result.user.email.toLowerCase() !== accessEmail.trim().toLowerCase())) {
      await this.tokenService.revokeByRawToken(result.tokens.refreshToken);
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    return result;
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (rawRefreshToken) await this.tokenService.revokeByRawToken(rawRefreshToken);
    // Idempotent: missing/unknown cookie is still a successful logout.
  }

  async verifyEmail(input: VerifyEmailInput): Promise<void> {
    const row = await this.emailTokenRepo.verify(hashToken(input.token));
    if (row.status !== "ok") throwTokenError(row.status);
    await this.events.emitAsync(IdentityEventTopic.EMAIL_VERIFIED, { userId: row.userId, date: new Date().toISOString().slice(0, 10) });
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

  /** Direct dispatch without the resend quota. Signup only; an address change uses {@link resendVerificationEmail}. */
  async sendVerificationEmail(user: UserRow): Promise<void> {
    await this.sendEmailToken(user, EmailTokenType.VERIFY_EMAIL);
  }

  /** Always resolves 200 — whether the email exists is never revealed. */
  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    await this.turnstile.assertValid(input.turnstileToken, "forgot-password");
    if (!(await this.rates.consumeAccount("forgot", input.email)).allowed) return;
    const user = await this.usersRepo.findByEmailService(input.email);
    if (!user) return;
    await this.sendEmailToken(user, EmailTokenType.RESET_PASSWORD);
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const tokenHash = hashToken(input.token);
    const preflight = await this.emailTokenRepo.inspectReset(tokenHash);
    if (preflight !== "ok") throwTokenError(preflight);
    const passwordHash = await argon2.hash(input.password);
    const result = await this.tokenService.resetPassword(tokenHash, passwordHash);
    if (result !== "ok") throwTokenError(result);
  }

  async deliverCurrentEmailToken(tokenHash: string, email: string, deliver: () => Promise<void>): Promise<void> {
    if (await this.emailTokenRepo.canDeliver(tokenHash, email)) await deliver();
  }

  private assertAccessEmail(email: string, accessEmail?: string): void {
    if ((this.config.get("NODE_ENV", { infer: true }) === "production" && !accessEmail) ||
        (accessEmail !== undefined && email.trim().toLowerCase() !== accessEmail.trim().toLowerCase())) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
  }

  private async sendEmailToken(user: UserRow, type: EmailTokenType): Promise<void> {
    const raw = randomBytes(32).toString("base64url");
    const ttl =
      type === EmailTokenType.VERIFY_EMAIL
        ? (await this.configRegistry.get(
            "identity.verification_email.token_ttl_seconds",
          )) * 1000
        : RESET_PASSWORD_TTL_MS;
    const appUrl = this.config.get("APP_URL", { infer: true });
    const path = type === EmailTokenType.VERIFY_EMAIL ? "eposta-dogrula" : "sifre-sifirla";
    const template =
      type === EmailTokenType.VERIFY_EMAIL
        ? EmailTemplate.VERIFY_EMAIL
        : EmailTemplate.RESET_PASSWORD;
    try {
      await this.emailTokenRepo.create({ userId: user.id, type, tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + ttl),
      }, user.email, (transaction) => this.queue.enqueue(JobName.SEND_EMAIL, {
          to: user.email, template,
          variables: { displayName: user.displayName, link: `${appUrl}/${path}?token=${raw}` },
          executionGuard: { type: "identity-email-token", tokenHash: hashToken(raw) },
        }, { transaction }));
    } catch (err) {
      this.logger.error(`email enqueue failed (${type}): ${String(err)}`);
    }
  }
}

function throwTokenError(status: "invalid" | "expired"): never {
  throw new DomainError(status === "invalid" ? ErrorCode.AUTH_TOKEN_INVALID : ErrorCode.AUTH_TOKEN_EXPIRED, HttpStatus.BAD_REQUEST);
}

/** Pre-computed argon2 hash of an unguessable value — used to equalize login timing. */
const DUMMY_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$RdescudvJCsgt3ub+b+dWRWJTmaaJObG";

function hasAdminPanelRole(roles: readonly string[]): boolean {
  return roles.some((role) => ADMIN_PANEL_ROLES.some((allowed) => allowed === role));
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
    examVariant: (user.examVariant as AuthUser["examVariant"]) ?? null,
    examDate: user.examDate ?? null,
    dailyFocusGoalMinutes: user.dailyFocusGoalMinutes ?? null,
    emailVerified: user.emailVerifiedAt != null,
    createdAt: user.createdAt.toISOString(),
  };
}
