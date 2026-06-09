import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { refreshTokens } from "../../../database/schema";

export type RefreshTokenRow = typeof refreshTokens.$inferSelect;

/**
 * Service-scoped: refresh flows run pre-/mid-auth (the cookie IS the credential),
 * so all access uses the SERVICE context. Only hashes are stored, never the token.
 */
@Injectable()
export class RefreshTokenRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(input: {
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRow> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx.insert(refreshTokens).values(input).returning();
      return rows[0]!;
    });
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1);
      return rows[0];
    });
  }

  /** Rotate: revoke the old row (returns it only if it was still active). */
  async revokeById(id: string): Promise<RefreshTokenRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .update(refreshTokens)
        .set({ revokedAt: sql`now()` })
        .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)))
        .returning();
      return rows[0];
    });
  }

  /** Reuse detected / password reset → kill the whole family (theft assumption). */
  async revokeFamily(familyId: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: sql`now()` })
        .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
    });
  }

  /** Logout-everywhere / password reset: revoke every active token of the user. */
  async revokeAllForUser(userId: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: sql`now()` })
        .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
    });
  }
}
