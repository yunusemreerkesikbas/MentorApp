import { Inject, Injectable } from "@nestjs/common";
import { and, eq, lte } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { phoneTrialClaims } from "../../../database/schema-phone-trials";

export type PhoneTrialClaim = typeof phoneTrialClaims.$inferSelect;

@Injectable()
export class PhoneTrialsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  findPendingForUser(userId: string, tx?: DatabaseTx): Promise<PhoneTrialClaim | undefined> {
    const read = async (exec: DatabaseTx) => (await exec.select().from(phoneTrialClaims)
      .where(and(eq(phoneTrialClaims.userId, userId), eq(phoneTrialClaims.status, "PENDING"))).limit(1))[0];
    return tx ? read(tx) : withServiceContext(this.db, read);
  }

  findByFingerprint(fingerprint: string): Promise<PhoneTrialClaim | undefined> {
    return withServiceContext(this.db, async (tx) => (await tx.select().from(phoneTrialClaims)
      .where(eq(phoneTrialClaims.phoneFingerprint, fingerprint)).limit(1))[0]);
  }

  async purgeFingerprint(fingerprint: string, now: Date, tx: DatabaseTx): Promise<void> {
    await tx.delete(phoneTrialClaims).where(and(eq(phoneTrialClaims.phoneFingerprint, fingerprint),
      eq(phoneTrialClaims.status, "CONSUMED"), lte(phoneTrialClaims.expiresAt, now)));
  }

  async reserve(input: Pick<typeof phoneTrialClaims.$inferInsert, "userId" | "phoneFingerprint" | "planId" | "code">, tx: DatabaseTx): Promise<PhoneTrialClaim> {
    return (await tx.insert(phoneTrialClaims).values(input).returning())[0]!;
  }

  async bind(id: string, subscriptionId: string, userId: string, tx: DatabaseTx): Promise<boolean> {
    return (await tx.update(phoneTrialClaims).set({ subscriptionId }).where(and(eq(phoneTrialClaims.id, id),
      eq(phoneTrialClaims.userId, userId), eq(phoneTrialClaims.status, "PENDING"))).returning({ id: phoneTrialClaims.id })).length > 0;
  }

  async saveCheckout(id: string, result: { providerRef: string; checkoutUrl: string }, userId: string, tx: DatabaseTx): Promise<boolean> {
    return (await tx.update(phoneTrialClaims).set(result).where(and(eq(phoneTrialClaims.id, id),
      eq(phoneTrialClaims.userId, userId), eq(phoneTrialClaims.status, "PENDING"))).returning({ id: phoneTrialClaims.id })).length > 0;
  }

  async findForSubscription(subscriptionId: string, tx: DatabaseTx): Promise<PhoneTrialClaim | undefined> {
    return (await tx.select().from(phoneTrialClaims).where(eq(phoneTrialClaims.subscriptionId, subscriptionId)).limit(1))[0];
  }

  async consumeForSubscription(subscriptionId: string, userId: string, now: Date, expiresAt: Date, tx: DatabaseTx): Promise<boolean> {
    const rows = await tx.select().from(phoneTrialClaims).where(and(eq(phoneTrialClaims.subscriptionId, subscriptionId),
      eq(phoneTrialClaims.userId, userId))).for("update");
    const claim = rows[0];
    if (!claim) return false;
    if (claim.status === "CONSUMED") return true;
    await tx.update(phoneTrialClaims).set({ status: "CONSUMED", consumedAt: now, expiresAt, checkoutUrl: null, code: null })
      .where(eq(phoneTrialClaims.id, claim.id));
    return true;
  }

  async release(id: string, tx?: DatabaseTx): Promise<void> {
    const apply = async (exec: DatabaseTx) => { await exec.delete(phoneTrialClaims)
      .where(and(eq(phoneTrialClaims.id, id), eq(phoneTrialClaims.status, "PENDING"))); };
    return tx ? apply(tx) : withServiceContext(this.db, apply);
  }

  async releaseForSubscription(subscriptionId: string, tx: DatabaseTx): Promise<void> {
    await tx.delete(phoneTrialClaims).where(and(eq(phoneTrialClaims.subscriptionId, subscriptionId), eq(phoneTrialClaims.status, "PENDING")));
  }

  async detachUser(userId: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.update(phoneTrialClaims).set({ providerRef: null })
        .where(and(eq(phoneTrialClaims.userId, userId), eq(phoneTrialClaims.status, "CONSUMED")));
      await tx.update(phoneTrialClaims).set({ userId: null, subscriptionId: null, checkoutUrl: null, code: null })
        .where(eq(phoneTrialClaims.userId, userId));
    });
  }

  async purgeExpired(now: Date): Promise<number> {
    return withServiceContext(this.db, async (tx) => (await tx.delete(phoneTrialClaims)
      .where(and(eq(phoneTrialClaims.status, "CONSUMED"), lte(phoneTrialClaims.expiresAt, now))).returning({ id: phoneTrialClaims.id })).length);
  }
}
