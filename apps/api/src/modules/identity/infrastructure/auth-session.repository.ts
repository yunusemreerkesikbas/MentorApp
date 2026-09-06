import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { emailTokens, refreshTokens, users } from "../../../database/schema";
import { authSessions } from "../../../database/schema-sessions";
import type { RequestUser } from "../../../common/auth/current-user";

interface NewRefresh { tokenHash: string; expiresAt: Date }

/** All writers lock the user FIRST, serializing issuance, refresh, logout and reset.
 * Denial is returned so replay revocation COMMITs before the application throws. */
@Injectable()
export class AuthSessionRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(userId: string, sessionId: string, refresh: NewRefresh, expectedPasswordHash?: string) {
    return withServiceContext(this.db, async (tx) => {
      const user = await lockUser(tx, userId);
      if (!user || user.status !== "ACTIVE" ||
          (expectedPasswordHash !== undefined && user.passwordHash !== expectedPasswordHash)) return null;
      await tx.insert(authSessions).values({
        id: sessionId, userId, organizationId: user.organizationId, expiresAt: refresh.expiresAt,
      });
      await tx.insert(refreshTokens).values({ userId, familyId: sessionId, ...refresh });
      return principal(user, sessionId);
    });
  }

  async rotate(tokenHash: string, next: NewRefresh): Promise<RequestUser | null> {
    return withServiceContext(this.db, async (tx) => {
      const [hint] = await tx.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
      if (!hint) return null;
      const user = await lockUser(tx, hint.userId);
      if (!user) return null;
      const [session] = await tx.select().from(authSessions).where(eq(authSessions.id, hint.familyId));
      const [token] = await tx.select().from(refreshTokens).where(eq(refreshTokens.id, hint.id));
      const now = new Date();
      if (!session || session.userId !== user.id || session.revokedAt ||
          session.expiresAt <= now || !token || token.revokedAt || token.expiresAt <= now || user.status !== "ACTIVE") {
        await revoke(tx, user.id, hint.familyId);
        return null;
      }
      await tx.update(refreshTokens).set({ revokedAt: now }).where(eq(refreshTokens.id, token.id));
      await tx.insert(refreshTokens).values({ userId: user.id, familyId: session.id, ...next });
      await tx.update(authSessions).set({ expiresAt: next.expiresAt }).where(eq(authSessions.id, session.id));
      return principal(user, session.id);
    });
  }

  async findActive(sessionId: string, userId?: string): Promise<RequestUser | null> {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx.select({ user: users, session: authSessions }).from(authSessions)
        .innerJoin(users, eq(users.id, authSessions.userId))
        .where(and(eq(authSessions.id, sessionId), isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, sql`now()`), eq(users.status, "ACTIVE"),
          userId ? eq(users.id, userId) : undefined));
      return row ? principal(row.user, row.session.id) : null;
    });
  }

  async revokeByTokenHash(tokenHash: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      const [token] = await tx.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
      if (!token || !await lockUser(tx, token.userId)) return;
      // A rotated cookie still identifies the family and its concurrent successor.
      await revoke(tx, token.userId, token.familyId);
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      if (await lockUser(tx, userId)) await revoke(tx, userId);
    });
  }

  async resetPassword(tokenHash: string, passwordHash: string): Promise<"ok" | "invalid" | "expired"> {
    return withServiceContext(this.db, async (tx) => {
      const [hint] = await tx.select().from(emailTokens).where(and(
        eq(emailTokens.tokenHash, tokenHash), eq(emailTokens.type, "RESET_PASSWORD")));
      if (!hint || !await lockUser(tx, hint.userId)) return "invalid";
      const [token] = await tx.select().from(emailTokens).where(eq(emailTokens.id, hint.id));
      if (!token || token.usedAt) return "invalid";
      if (token.expiresAt <= new Date()) return "expired";
      await tx.update(users).set({ passwordHash, updatedAt: sql`now()` }).where(eq(users.id, token.userId));
      await tx.update(emailTokens).set({ usedAt: sql`now()` }).where(and(
        eq(emailTokens.userId, token.userId), eq(emailTokens.type, "RESET_PASSWORD"), isNull(emailTokens.usedAt)));
      await revoke(tx, token.userId);
      return "ok";
    });
  }
}

function lockUser(tx: DatabaseTx, userId: string) {
  return tx.select().from(users).where(eq(users.id, userId)).for("update").then((rows) => rows[0]);
}

async function revoke(tx: DatabaseTx, userId: string, sessionId?: string) {
  await tx.update(authSessions).set({ revokedAt: sql`now()` }).where(and(
    eq(authSessions.userId, userId), isNull(authSessions.revokedAt),
    sessionId ? eq(authSessions.id, sessionId) : undefined));
  await tx.update(refreshTokens).set({ revokedAt: sql`now()` }).where(and(
    eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt),
    sessionId ? eq(refreshTokens.familyId, sessionId) : undefined));
}

function principal(user: typeof users.$inferSelect, sessionId: string): RequestUser {
  return { id: user.id, roles: user.roles, orgId: user.organizationId, sessionId };
}
