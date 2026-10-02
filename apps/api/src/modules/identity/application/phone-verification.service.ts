import { randomUUID } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { PhoneStatusDto, PhoneVerificationDto } from "@mentor/types";
import type { PhoneVerificationRequestInput } from "@mentor/validation";
import type { RequestUser } from "../../../common/auth/current-user";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { isUniqueViolation } from "../../../common/errors/postgres-error";
import type { Env } from "../../../config/env.validation";
import { IdentityEventTopic } from "../domain/identity.events";
import { generatePhoneCode, hashPhoneCode, maskPhone, phoneAccountKey, phoneFingerprint } from "../domain/phone";
import { NetgsmSmsAdapter } from "../infrastructure/netgsm-sms.adapter";
import { PhoneVerificationRepository, type PhonePolicy } from "../infrastructure/phone-verification.repository";
import { TurnstileService } from "./turnstile.service";

@Injectable()
export class PhoneVerificationService {
  constructor(private readonly repo: PhoneVerificationRepository, private readonly sms: NetgsmSmsAdapter,
    private readonly env: ConfigService<Env, true>, private readonly config: ConfigRegistryService,
    private readonly turnstile: TurnstileService, private readonly events: EventEmitter2) {}

  async getStatus(user: RequestUser): Promise<PhoneStatusDto> {
    const [state, available, reauthSeconds] = await Promise.all([
      this.repo.getState(user.id, user.sessionId), this.available(),
      this.config.get("identity.phone.reauthentication_seconds"),
    ]);
    if (!state) throw new DomainError(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED);
    const verified = Boolean(state.phoneNumber && state.phoneVerifiedAt);
    return { verified, maskedPhoneNumber: verified ? maskPhone(state.phoneNumber!) : null, available,
      reauthenticationRequired: verified && state.sessionCreatedAt.getTime() < Date.now() - Number(reauthSeconds) * 1000 };
  }

  async requestVerification(user: RequestUser, input: PhoneVerificationRequestInput): Promise<PhoneVerificationDto> {
    if (!await this.available()) throw new DomainError(ErrorCode.AUTH_PHONE_DISABLED, HttpStatus.SERVICE_UNAVAILABLE);
    await this.turnstile.assertValid(input.turnstileToken, "phone-verification");
    const [state, policy] = await Promise.all([this.repo.getState(user.id, user.sessionId), this.policy()]);
    if (!state) throw new DomainError(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED);
    if (state.phoneVerifiedAt && state.phoneNumber === input.phoneNumber) {
      throw new DomainError(ErrorCode.AUTH_PHONE_UNAVAILABLE, HttpStatus.CONFLICT);
    }
    const id = randomUUID();
    const code = generatePhoneCode();
    const now = Date.now();
    const binding = { id, userId: user.id, sessionId: user.sessionId, phoneNumber: input.phoneNumber,
      purpose: state.phoneVerifiedAt ? "CHANGE" : "BIND" };
    const fingerprintSecret = this.env.get("PHONE_FINGERPRINT_SECRET", { infer: true })!;
    const reserved = await this.repo.reserve({ ...binding, organizationId: user.orgId,
      previousPhoneNumber: state.phoneNumber,
      phoneKey: phoneFingerprint(fingerprintSecret, input.phoneNumber),
      codeHash: hashPhoneCode(this.env.get("PHONE_OTP_SECRET", { infer: true })!, binding, code),
      expiresAt: new Date(now + policy.ttlSeconds * 1000),
      resendAvailableAt: new Date(now + policy.resendSeconds * 1000),
    }, phoneAccountKey(fingerprintSecret, user.id), policy);
    if (reserved.error) this.reject(reserved.error);
    const challenge = reserved.value!;
    const timeout = Number(await this.config.get("identity.phone.provider_timeout_ms"));
    const result = await this.sms.sendCode(input.phoneNumber, code, timeout, policy.ttlSeconds);
    await this.repo.recordSend(id, result.status);
    if (result.status === "FAILED") throw new DomainError(ErrorCode.AUTH_PHONE_DISABLED, HttpStatus.SERVICE_UNAVAILABLE);
    return { challengeId: id, expiresAt: challenge.expiresAt.toISOString(),
      resendAvailableAt: challenge.resendAvailableAt.toISOString(), maskedPhoneNumber: maskPhone(input.phoneNumber), sendStatus: result.status };
  }

  async confirmVerification(user: RequestUser, id: string, code: string): Promise<PhoneStatusDto> {
    if (!await this.available()) throw new DomainError(ErrorCode.AUTH_PHONE_DISABLED, HttpStatus.SERVICE_UNAVAILABLE);
    try {
      const result = await this.repo.confirm(user.id, user.sessionId, id, code,
        this.env.get("PHONE_OTP_SECRET", { infer: true })!,
        phoneAccountKey(this.env.get("PHONE_FINGERPRINT_SECRET", { infer: true })!, user.id), await this.policy());
      if (result.error) this.reject(result.error);
    } catch (err) {
      if (isUniqueViolation(err)) throw new DomainError(ErrorCode.AUTH_PHONE_UNAVAILABLE, HttpStatus.CONFLICT);
      throw err;
    }
    // Listeners retry/reconcile through their existing idempotent paths; SMS ownership has committed.
    await this.events.emitAsync(IdentityEventTopic.PHONE_VERIFIED, { userId: user.id });
    return this.getStatus(user);
  }

  purgeExpired() { return this.repo.purgeExpired(); }

  private async available(): Promise<boolean> {
    return Boolean(await this.config.get("identity.phone.enabled")) && this.sms.isAvailable() &&
      Boolean(this.env.get("PHONE_OTP_SECRET", { infer: true }) && this.env.get("PHONE_FINGERPRINT_SECRET", { infer: true }));
  }

  private async policy(): Promise<PhonePolicy> {
    const keys = ["code_ttl_seconds", "resend_seconds", "challenge_attempts", "failed_daily_limit",
      "send_daily_limit", "global_daily_limit", "global_monthly_limit", "reauthentication_seconds"] as const;
    const values = await Promise.all(keys.map((key) => this.config.get(`identity.phone.${key}`)));
    const [ttlSeconds, resendSeconds, challengeAttempts, failedDailyLimit, sendDailyLimit,
      globalDailyLimit, globalMonthlyLimit, reauthenticationSeconds] = values.map(Number);
    return { ttlSeconds: ttlSeconds!, resendSeconds: resendSeconds!, challengeAttempts: challengeAttempts!,
      failedDailyLimit: failedDailyLimit!, sendDailyLimit: sendDailyLimit!, globalDailyLimit: globalDailyLimit!,
      globalMonthlyLimit: globalMonthlyLimit!, reauthenticationSeconds: reauthenticationSeconds! };
  }

  private reject(code: string): never {
    const status = code === ErrorCode.UNAUTHORIZED ? HttpStatus.UNAUTHORIZED :
      code === ErrorCode.AUTH_PHONE_RATE_LIMITED ? HttpStatus.TOO_MANY_REQUESTS :
      code === ErrorCode.AUTH_PHONE_REAUTHENTICATION_REQUIRED ? HttpStatus.FORBIDDEN :
      code === ErrorCode.AUTH_PHONE_UNAVAILABLE ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST;
    throw new DomainError(code, status);
  }
}
