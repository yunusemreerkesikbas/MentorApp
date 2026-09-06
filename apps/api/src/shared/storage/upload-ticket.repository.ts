import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gt, gte, inArray, sql } from "drizzle-orm";
import { DRIZZLE } from "../../database/database.constants";
import type { Database } from "../../database/drizzle";
import { withServiceContext, withUserContext } from "../../database/rls";
import { uploadTickets } from "../../database/schema-uploads";
import { authSessions } from "../../database/schema-sessions";
import { users } from "../../database/schema";
import { DomainError, UnauthorizedError } from "../../common/errors/domain-error";
import { ErrorCode } from "../../common/errors/error-code";

export type UploadTicket = typeof uploadTickets.$inferSelect;

@Injectable()
export class UploadTicketRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async issue(row: typeof uploadTickets.$inferInsert, activeLimit: number, dailyBytes: number): Promise<void> {
    await withUserContext(this.db, { userId: row.ownerId }, async (tx) => {
      const [session] = await tx.select({ orgId: users.organizationId }).from(authSessions)
        .innerJoin(users, eq(users.id, authSessions.userId)).where(and(
          eq(authSessions.id, row.sessionId), eq(authSessions.userId, row.ownerId),
          eq(users.status, "ACTIVE"), gt(authSessions.expiresAt, sql`now()`),
          sql`${authSessions.revokedAt} is null`)).for("update");
      if (!session) throw new UnauthorizedError();
      row.orgId = session.orgId;
      // All uploads for an owner serialize across processes, including claim/quota updates.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`upload:${row.ownerId}`}, 0))`);
      const now = new Date();
      const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const active = await tx.select({ id: uploadTickets.id }).from(uploadTickets).where(and(eq(uploadTickets.ownerId, row.ownerId), inArray(uploadTickets.status, ["ISSUED", "CLAIMED"]), gt(uploadTickets.expiresAt, now)));
      const [usage] = await tx.select({ total: sql<number>`coalesce(sum(${uploadTickets.chargedBytes}), 0)` }).from(uploadTickets).where(and(eq(uploadTickets.ownerId, row.ownerId), gte(uploadTickets.claimedAt, day)));
      if (active.length >= activeLimit || Number(usage?.total ?? 0) + row.maxBytes > dailyBytes) throw new DomainError(ErrorCode.BAD_REQUEST, 429, { reason: "upload_limit" });
      await tx.insert(uploadTickets).values(row);
    });
  }

  find(tokenHash: string): Promise<UploadTicket | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx.select().from(uploadTickets).where(eq(uploadTickets.tokenHash, tokenHash)).limit(1);
      return row;
    });
  }

  async assertActiveSession(ticket: UploadTicket): Promise<void> {
    const active = await withServiceContext(this.db, async (tx) => {
      const [row] = await tx.select({ id: authSessions.id }).from(authSessions)
        .innerJoin(users, eq(users.id, authSessions.userId)).where(and(
          eq(authSessions.id, ticket.sessionId), eq(authSessions.userId, ticket.ownerId),
          eq(users.status, "ACTIVE"), gt(authSessions.expiresAt, sql`now()`),
          sql`${authSessions.revokedAt} is null`)).limit(1);
      return row;
    });
    if (!active) throw new UnauthorizedError();
  }

  async claim(ticket: UploadTicket, dailyBytes: number): Promise<UploadTicket> {
    return withUserContext(this.db, { userId: ticket.ownerId }, async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`upload:${ticket.ownerId}`}, 0))`);
      const now = new Date();
      const [session] = await tx.select({ id: authSessions.id }).from(authSessions)
        .innerJoin(users, eq(users.id, authSessions.userId)).where(and(
          eq(authSessions.id, ticket.sessionId), eq(authSessions.userId, ticket.ownerId),
          eq(users.status, "ACTIVE"), gt(authSessions.expiresAt, now),
          sql`${authSessions.revokedAt} is null`)).for("update");
      if (!session) throw new UnauthorizedError();
      const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const [usage] = await tx.select({ total: sql<number>`coalesce(sum(${uploadTickets.chargedBytes}), 0)` }).from(uploadTickets).where(and(eq(uploadTickets.ownerId, ticket.ownerId), gte(uploadTickets.claimedAt, day)));
      if (Number(usage?.total ?? 0) + ticket.maxBytes > dailyBytes) throw new DomainError(ErrorCode.BAD_REQUEST, 429, { reason: "upload_limit" });
      const [claimed] = await tx.update(uploadTickets).set({ status: "CLAIMED", claimedAt: now, chargedBytes: ticket.maxBytes }).where(and(eq(uploadTickets.id, ticket.id), eq(uploadTickets.ownerId, ticket.ownerId), eq(uploadTickets.status, "ISSUED"), gt(uploadTickets.expiresAt, now))).returning();
      if (!claimed) throw new UnauthorizedError();
      return claimed;
    });
  }

  async finish(ticket: UploadTicket, status: "COMPLETE" | "FAILED", actualBytes?: number): Promise<void> {
    await withUserContext(this.db, { userId: ticket.ownerId }, async (tx) => {
      await tx.update(uploadTickets).set({ status, ...(actualBytes === undefined ? {} : { chargedBytes: actualBytes }) }).where(and(eq(uploadTickets.id, ticket.id), eq(uploadTickets.ownerId, ticket.ownerId), eq(uploadTickets.status, "CLAIMED")));
    });
  }
}
