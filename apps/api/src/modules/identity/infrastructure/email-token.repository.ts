import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { emailTokens, emailVerificationResendAttempts, users } from "../../../database/schema";
import type { EmailTokenType } from "../domain/identity.constants";
import { lockUser } from "./auth-session.repository";

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
  }, expectedEmail: string, enqueue: (tx: DatabaseTx) => Promise<unknown>): Promise<EmailTokenRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const user = await lockUser(tx, input.userId);
      if (!user || user.status !== "ACTIVE" || user.erasureStartedAt || user.email !== expectedEmail) return undefined;
      const rows = await tx.insert(emailTokens).values(input).returning();
      await enqueue(tx);
      return rows[0]!;
    });
  }

  /** Verification and token consumption share the same user lock as address changes. */
  async verify(tokenHash: string): Promise<{ status: "ok"; userId: string } | { status: "invalid" | "expired" }> {
    return withServiceContext(this.db, async (tx) => {
      const [hint] = await tx.select().from(emailTokens).where(and(
        eq(emailTokens.tokenHash, tokenHash), eq(emailTokens.type, "VERIFY_EMAIL")));
      if (!hint) return { status: "invalid" };
      const user = await lockUser(tx, hint.userId);
      if (!user || user.status !== "ACTIVE" || user.erasureStartedAt) return { status: "invalid" };
      const [token] = await tx.select().from(emailTokens).where(eq(emailTokens.id, hint.id));
      if (!token || token.usedAt) return { status: "invalid" };
      if (token.expiresAt <= new Date()) return { status: "expired" };
      await tx.update(emailTokens).set({ usedAt: sql`now()` }).where(eq(emailTokens.id, token.id));
      await tx.update(users).set({ emailVerifiedAt: sql`now()` }).where(eq(users.id, user.id));
      return { status: "ok", userId: user.id };
    });
  }

  /** Cheap preflight before Argon2; reset still rechecks under the user lock before consuming. */
  async inspectReset(tokenHash: string): Promise<"ok" | "invalid" | "expired"> {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx.select().from(emailTokens).where(and(eq(emailTokens.tokenHash, tokenHash),
        eq(emailTokens.type, "RESET_PASSWORD"), isNull(emailTokens.usedAt)));
      return !row ? "invalid" : row.expiresAt <= new Date() ? "expired" : "ok";
    });
  }

  /** Suppress queued stale recipients. A later change invalidates the link before redemption. */
  async canDeliver(tokenHash: string, expectedEmail: string): Promise<boolean> {
    return withServiceContext(this.db, async (tx) => {
      const [hint] = await tx.select().from(emailTokens).where(eq(emailTokens.tokenHash, tokenHash));
      if (!hint) return false;
      const user = await lockUser(tx, hint.userId);
      if (!user || user.status !== "ACTIVE" || user.erasureStartedAt || user.email !== expectedEmail) return false;
      const [token] = await tx.select().from(emailTokens).where(eq(emailTokens.id, hint.id));
      return !!token && !token.usedAt && token.expiresAt > new Date();
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
