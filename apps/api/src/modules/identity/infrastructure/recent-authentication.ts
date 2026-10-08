import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { authSessions } from "../../../database/schema-sessions";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";

/** Call only while holding the user's lock; refresh preserves the session creation time. */
export async function requireRecentAuthentication(tx: DatabaseTx, userId: string,
  sessionId: string | undefined, seconds: number): Promise<void> {
  const [session] = sessionId ? await tx.select({ id: authSessions.id }).from(authSessions).where(and(
    eq(authSessions.id, sessionId), eq(authSessions.userId, userId),
    isNull(authSessions.revokedAt), gt(authSessions.expiresAt, sql`now()`),
    gt(authSessions.createdAt, sql`now() - ${seconds} * interval '1 second'`),
  )) : [];
  if (!session) throw new DomainError(ErrorCode.AUTH_REAUTHENTICATION_REQUIRED, 403);
}
