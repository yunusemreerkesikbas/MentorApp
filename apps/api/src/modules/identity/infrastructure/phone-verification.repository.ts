import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { users } from "../../../database/schema";
import { phoneOtpAttempts, phoneVerifications } from "../../../database/schema-phone";
import { authSessions } from "../../../database/schema-sessions";
import { hashPhoneCode, phoneCodeMatches } from "../domain/phone";
import { ErrorCode } from "../../../common/errors/error-code";

export interface PhonePolicy {
  ttlSeconds: number; resendSeconds: number; challengeAttempts: number;
  failedDailyLimit: number; sendDailyLimit: number; globalDailyLimit: number;
  globalMonthlyLimit: number; reauthenticationSeconds: number;
}
type Challenge = typeof phoneVerifications.$inferSelect;
type NewChallenge = typeof phoneVerifications.$inferInsert;
type Result<T> = { value: T; error?: never } | { error: string; value?: never };

@Injectable()
export class PhoneVerificationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async getState(userId: string, sessionId: string) {
    return withServiceContext(this.db, (tx) => this.state(tx, userId, sessionId));
  }

  async reserve(input: NewChallenge, accountKey: string, policy: PhonePolicy): Promise<Result<Challenge>> {
    return withServiceContext(this.db, async (tx) => {
      await quotaLock(tx);
      const current = await this.state(tx, input.userId, input.sessionId, true);
      if (!current) return { error: ErrorCode.UNAUTHORIZED };
      if (current.phoneNumber !== (input.previousPhoneNumber ?? null)) return { error: ErrorCode.AUTH_PHONE_CODE_INVALID };
      if (current.phoneVerifiedAt && !recent(current.sessionCreatedAt, policy)) {
        return { error: ErrorCode.AUTH_PHONE_REAUTHENTICATION_REQUIRED };
      }
      const [last] = await tx.select().from(phoneVerifications)
        .where(eq(phoneVerifications.userId, input.userId)).orderBy(desc(phoneVerifications.createdAt)).limit(1);
      const now = new Date();
      if (last && last.resendAvailableAt > now) return { error: ErrorCode.AUTH_PHONE_RATE_LIMITED };
      const dayAgo = new Date(now.getTime() - 86_400_000);
      const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const sends = await tx.select({
        account: sql<number>`count(*) filter (where ${phoneOtpAttempts.accountKey} = ${accountKey} and ${phoneOtpAttempts.createdAt} >= ${dayAgo})::int`,
        phone: sql<number>`count(*) filter (where ${phoneOtpAttempts.phoneKey} = ${input.phoneKey} and ${phoneOtpAttempts.createdAt} >= ${dayAgo})::int`,
        day: sql<number>`count(*) filter (where ${phoneOtpAttempts.createdAt} >= ${dayAgo})::int`,
        month: sql<number>`count(*) filter (where ${phoneOtpAttempts.createdAt} >= ${month})::int`,
      }).from(phoneOtpAttempts).where(and(eq(phoneOtpAttempts.kind, "SEND"),
        gte(phoneOtpAttempts.createdAt, dayAgo < month ? dayAgo : month)));
      const count = sends[0]!;
      if (count.account >= policy.sendDailyLimit || count.phone >= policy.sendDailyLimit ||
          count.day >= policy.globalDailyLimit || count.month >= policy.globalMonthlyLimit) {
        return { error: ErrorCode.AUTH_PHONE_RATE_LIMITED };
      }
      await tx.update(phoneVerifications).set({ invalidatedAt: now }).where(and(
        eq(phoneVerifications.userId, input.userId), isNull(phoneVerifications.usedAt), isNull(phoneVerifications.invalidatedAt)));
      await tx.insert(phoneOtpAttempts).values({ kind: "SEND", accountKey, phoneKey: input.phoneKey });
      const [challenge] = await tx.insert(phoneVerifications).values(input).returning();
      return { value: challenge! };
    });
  }

  async recordSend(id: string, status: "SENT" | "UNKNOWN" | "FAILED"): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.update(phoneVerifications).set({ sendStatus: status }).where(eq(phoneVerifications.id, id));
    });
  }

  /** Denials are returned so failed-code counters commit before the service throws. */
  async confirm(userId: string, sessionId: string, id: string, code: string,
    secret: string, accountKey: string, policy: PhonePolicy): Promise<Result<true>> {
    return withServiceContext(this.db, async (tx) => {
      await quotaLock(tx);
      const current = await this.state(tx, userId, sessionId, true);
      if (!current) return { error: ErrorCode.UNAUTHORIZED };
      const [challenge] = await tx.select().from(phoneVerifications).where(and(
        eq(phoneVerifications.id, id), eq(phoneVerifications.userId, userId),
        eq(phoneVerifications.sessionId, sessionId))).for("update");
      if (!challenge || challenge.usedAt || challenge.invalidatedAt ||
          !["SENT", "UNKNOWN"].includes(challenge.sendStatus) ||
          current.phoneNumber !== challenge.previousPhoneNumber) return { error: ErrorCode.AUTH_PHONE_CODE_INVALID };
      if (challenge.expiresAt <= new Date()) return { error: ErrorCode.AUTH_PHONE_CODE_EXPIRED };
      if (current.phoneVerifiedAt && !recent(current.sessionCreatedAt, policy)) {
        return { error: ErrorCode.AUTH_PHONE_REAUTHENTICATION_REQUIRED };
      }
      const [failures] = await tx.select({ count: sql<number>`count(*)::int` }).from(phoneOtpAttempts)
        .where(and(eq(phoneOtpAttempts.kind, "FAIL"), eq(phoneOtpAttempts.accountKey, accountKey),
          gte(phoneOtpAttempts.createdAt, new Date(Date.now() - 86_400_000))));
      if (challenge.failedAttempts >= policy.challengeAttempts || failures!.count >= policy.failedDailyLimit) {
        return { error: ErrorCode.AUTH_PHONE_RATE_LIMITED };
      }
      if (!phoneCodeMatches(challenge.codeHash, hashPhoneCode(secret, challenge, code))) {
        await tx.update(phoneVerifications).set({ failedAttempts: sql`${phoneVerifications.failedAttempts} + 1` })
          .where(eq(phoneVerifications.id, id));
        await tx.insert(phoneOtpAttempts).values({ kind: "FAIL", accountKey, phoneKey: challenge.phoneKey });
        return { error: ErrorCode.AUTH_PHONE_CODE_INVALID };
      }
      const [taken] = await tx.select({ id: users.id }).from(users).where(and(
        eq(users.phoneNumber, challenge.phoneNumber), eq(users.status, "ACTIVE"), sql`${users.phoneVerifiedAt} is not null`));
      if (taken && taken.id !== userId) return { error: ErrorCode.AUTH_PHONE_UNAVAILABLE };
      await tx.update(users).set({ phoneNumber: challenge.phoneNumber, phoneVerifiedAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(users.id, userId));
      await tx.update(phoneVerifications).set({ usedAt: sql`now()` }).where(eq(phoneVerifications.id, id));
      return { value: true };
    });
  }

  async purgeExpired(): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.delete(phoneVerifications).where(lt(phoneVerifications.expiresAt, new Date()));
      // A full 32 days retains every current UTC month's sends, including leap/month boundaries.
      await tx.delete(phoneOtpAttempts).where(lt(phoneOtpAttempts.createdAt, new Date(Date.now() - 32 * 86_400_000)));
    });
  }

  private async state(tx: DatabaseTx, userId: string, sessionId: string, lock = false) {
    const query = tx.select().from(users).where(and(eq(users.id, userId), eq(users.status, "ACTIVE")));
    const [user] = await (lock ? query.for("update") : query);
    if (!user) return null;
    const [session] = await tx.select().from(authSessions).where(and(
      eq(authSessions.id, sessionId), eq(authSessions.userId, userId), isNull(authSessions.revokedAt),
      sql`${authSessions.expiresAt} > now()`));
    if (!session) return null;
    return { phoneNumber: user.phoneNumber, phoneVerifiedAt: user.phoneVerifiedAt,
      organizationId: user.organizationId, sessionCreatedAt: session.createdAt };
  }
}

async function quotaLock(tx: DatabaseTx) {
  // ponytail: one short global DB lock serializes OTP accounting at <=100 sends/day; split locks if throughput grows.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('identity.phone.quota'))`);
}
function recent(createdAt: Date, policy: PhonePolicy): boolean {
  return createdAt.getTime() >= Date.now() - policy.reauthenticationSeconds * 1000;
}
