import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { eq, inArray } from "drizzle-orm";
import request from "supertest";
import { DRIZZLE } from "../src/database/database.constants";
import type { Database } from "../src/database/drizzle";
import { withServiceContext } from "../src/database/rls";
import { configOverrides, refreshTokens, users } from "../src/database/schema";
import { phoneOtpAttempts, phoneVerifications } from "../src/database/schema-phone";
import { authSessions } from "../src/database/schema-sessions";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";
import { UsersRepository } from "../src/modules/identity/infrastructure/users.repository";
import { TokenService } from "../src/modules/identity/application/token.service";
import { phoneAccountKey } from "../src/modules/identity/domain/phone";

export const TEST_PHONE_FINGERPRINT_SECRET = "test-phone-fingerprint-secret-32-characters";
export const TEST_PHONE_OTP_SECRET = "test-phone-code-hmac-secret-32-characters";
export interface PhoneTestAccount { id: string; accessToken: string; sessionId: string; refreshToken: string; phone: string }

export class PhoneTestHarness {
  readonly accounts: PhoneTestAccount[] = [];
  readonly db: Database;
  readonly config: ConfigRegistryService;
  readonly tokens: TokenService;
  private phoneSequence = Date.now() % 9_000_000;
  constructor(readonly app: INestApplication) {
    this.db = app.get(DRIZZLE);
    this.config = app.get(ConfigRegistryService);
    this.tokens = app.get(TokenService);
  }

  async account(): Promise<PhoneTestAccount> {
    const user = await this.app.get(UsersRepository).createService({ email: `phone-${randomUUID()}@test.local`,
      displayName: "Phone test", passwordHash: "not-used-for-password-login", kvkkAcceptedAt: new Date() });
    const token = await this.tokens.issue(user);
    const { sid } = this.app.get(JwtService).decode<{ sid: string }>(token.accessToken);
    const account = { id: user.id, accessToken: token.accessToken, sessionId: sid,
      refreshToken: token.refreshToken, phone: `+90532${(++this.phoneSequence).toString().padStart(7, "0")}` };
    this.accounts.push(account);
    return account;
  }

  send(user: PhoneTestAccount, phoneNumber = user.phone) {
    return request(this.app.getHttpServer()).post("/v1/users/me/phone/verifications")
      .set("Authorization", `Bearer ${user.accessToken}`).send({ phoneNumber });
  }
  confirm(user: PhoneTestAccount, id: string, code: string) {
    return request(this.app.getHttpServer()).post(`/v1/users/me/phone/verifications/${id}/confirm`)
      .set("Authorization", `Bearer ${user.accessToken}`).send({ code });
  }
  status(user: PhoneTestAccount) {
    return request(this.app.getHttpServer()).get("/v1/users/me/phone")
      .set("Authorization", `Bearer ${user.accessToken}`);
  }
  set(key: string, value: unknown) { return this.config.set(this.accounts[0]!.id, key, value); }
  async allowResend(user: PhoneTestAccount) {
    await withServiceContext(this.db, async (tx) => {
      await tx.update(phoneVerifications).set({ resendAvailableAt: new Date(Date.now() - 1000) })
        .where(eq(phoneVerifications.userId, user.id));
    });
  }
  async ageSession(user: PhoneTestAccount) {
    await withServiceContext(this.db, async (tx) => {
      await tx.update(authSessions).set({ createdAt: new Date(Date.now() - 11 * 60_000) })
        .where(eq(authSessions.id, user.sessionId));
    });
  }
  async clean() {
    const ids = this.accounts.map((account) => account.id);
    if (!ids.length) return;
    await withServiceContext(this.db, async (tx) => {
      await tx.delete(configOverrides).where(inArray(configOverrides.updatedBy, ids));
      await tx.delete(phoneOtpAttempts).where(inArray(phoneOtpAttempts.accountKey,
        ids.map((id) => phoneAccountKey(TEST_PHONE_FINGERPRINT_SECRET, id))));
      await tx.delete(phoneVerifications).where(inArray(phoneVerifications.userId, ids));
      await tx.delete(authSessions).where(inArray(authSessions.userId, ids));
      // Refresh rows refer to users even after their session was revoked.
      await tx.delete(refreshTokens).where(inArray(refreshTokens.userId, ids));
      await tx.delete(users).where(inArray(users.id, ids));
    });
  }
}
