import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { emailTokens, emailVerificationResendAttempts } from "../../../database/schema";
import type { EmailTokenType } from "../domain/identity.constants";

export type EmailTokenRow = typeof emailTokens.$inferSelect;

/** One-time tokens (verify/reset). Service-scoped — these flows carry no user session. */
@Injectable()
export class EmailTokenRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(input: {
    userId: string;
    type: EmailTokenType;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<EmailTokenRow> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx.insert(emailTokens).values(input).returning();
      return rows[0]!;
    });
  }

  /** Atomically consume an unused token of the given type (single use). */
  async consume(tokenHash: string, type: EmailTokenType): Promise<EmailTokenRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .update(emailTokens)
        .set({ usedAt: sql`now()` })
        .where(
          and(
            eq(emailTokens.tokenHash, tokenHash),
            eq(emailTokens.type, type),
            isNull(emailTokens.usedAt),
          ),
        )
        .returning();
      return rows[0];
    });
  }

  async countVerificationResendAttemptsSince(
    userId: string,
    since: Date,
  ): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(emailVerificationResendAttempts)
        .where(
          and(
            eq(emailVerificationResendAttempts.userId, userId),
            gte(emailVerificationResendAttempts.createdAt, since),
          ),
        );
      return rows[0]?.count ?? 0;
    });
  }

  async createVerificationResendAttempt(userId: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.insert(emailVerificationResendAttempts).values({ userId });
    });
  }
}
