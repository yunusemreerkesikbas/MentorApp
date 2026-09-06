import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { googleLinkIntents } from "../../../database/schema-google-linking";
import { authSessions } from "../../../database/schema-sessions";
import { userAuthAccounts, users } from "../../../database/schema";
import { AuthProvider, UserStatus } from "../domain/identity.constants";

@Injectable()
export class GoogleLinkingRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(input: typeof googleLinkIntents.$inferInsert): Promise<void> {
    await withUserContext(this.db, { userId: input.userId }, async (tx) => {
      await tx.insert(googleLinkIntents).values(input);
    });
  }

  async consume(nonceHash: string, userId: string, sessionId: string): Promise<boolean> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const rows = await tx.update(googleLinkIntents).set({ usedAt: sql`now()` }).where(and(
        eq(googleLinkIntents.nonceHash, nonceHash),
        eq(googleLinkIntents.userId, userId),
        eq(googleLinkIntents.sessionId, sessionId),
        isNull(googleLinkIntents.usedAt),
        gt(googleLinkIntents.expiresAt, sql`now()`),
      )).returning({ id: googleLinkIntents.id });
      return rows.length === 1;
    });
  }

  /** Lock the owner then session so a concurrent reset/logout cannot precede the link commit. */
  async linkActiveSession(input: {
    userId: string;
    sessionId: string;
    providerSubject: string;
    providerEmail: string;
  }): Promise<boolean> {
    return withUserContext(this.db, { userId: input.userId }, async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.id, input.userId)).for("update");
      if (!user || user.status !== UserStatus.ACTIVE || !user.emailVerifiedAt ||
          user.email.toLowerCase() !== input.providerEmail.toLowerCase()) return false;
      const [session] = await tx.select().from(authSessions).where(and(
        eq(authSessions.id, input.sessionId), eq(authSessions.userId, input.userId),
        isNull(authSessions.revokedAt), gt(authSessions.expiresAt, sql`now()`),
      )).for("update");
      if (!session) return false;
      await tx.insert(userAuthAccounts).values({
        userId: input.userId,
        provider: AuthProvider.GOOGLE,
        providerSubject: input.providerSubject,
        providerEmail: input.providerEmail,
      });
      return true;
    });
  }
}
