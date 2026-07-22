import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { buddyPairs, users } from "../../../database/schema";

export type BuddyPairRow = typeof buddyPairs.$inferSelect;

/** A pair row joined with the OTHER party's public display fields. */
export interface BuddyPairWithUserRow extends BuddyPairRow {
  otherUserId: string;
  otherDisplayName: string;
  otherUsername: string | null;
  otherAvatarStorageKey: string | null;
}

const VISIBLE_USER = sql`${users.status} not in ('BANNED', 'SUSPENDED')`;

/**
 * Study-buddy pairs (`buddy_pairs`). Runs in SERVICE context and is own-user scoped
 * by the WHERE clause (the caller id is always the authenticated user — no forging),
 * mirroring FollowRepository's trust model. BANNED/SUSPENDED counterparts are excluded.
 */
@Injectable()
export class BuddyRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The user's ACTIVE pair with the partner's display fields, if any. */
  async findActiveByUser(userId: string): Promise<BuddyPairWithUserRow | undefined> {
    const rows = await this.listWithOther(userId, eq(buddyPairs.status, "ACTIVE"), 1);
    return rows[0];
  }

  /** The user's outgoing PENDING request (max one, service-enforced), if any. */
  async findOutgoingPending(userId: string): Promise<BuddyPairWithUserRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select(this.withOtherSelection(buddyPairs.addresseeId))
        .from(buddyPairs)
        .innerJoin(users, eq(users.id, buddyPairs.addresseeId))
        .where(
          and(
            eq(buddyPairs.requesterId, userId),
            eq(buddyPairs.status, "PENDING"),
            VISIBLE_USER,
          ),
        )
        .limit(1);
      return rows[0];
    });
  }

  /** Incoming PENDING requests (newest first), requester display fields joined. */
  async listIncomingPending(userId: string): Promise<BuddyPairWithUserRow[]> {
    return withServiceContext(this.db, (tx) =>
      tx
        .select(this.withOtherSelection(buddyPairs.requesterId))
        .from(buddyPairs)
        .innerJoin(users, eq(users.id, buddyPairs.requesterId))
        .where(
          and(
            eq(buddyPairs.addresseeId, userId),
            eq(buddyPairs.status, "PENDING"),
            VISIBLE_USER,
          ),
        )
        .orderBy(sql`${buddyPairs.createdAt} desc`),
    );
  }

  /** Any row (either direction, any status) between two users. */
  async findBetween(userA: string, userB: string): Promise<BuddyPairRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(buddyPairs)
        .where(
          or(
            and(eq(buddyPairs.requesterId, userA), eq(buddyPairs.addresseeId, userB)),
            and(eq(buddyPairs.requesterId, userB), eq(buddyPairs.addresseeId, userA)),
          ),
        )
        .limit(1);
      return rows[0];
    });
  }

  /** A PENDING row by id where `userId` is a party (requester or addressee). */
  async findPendingById(id: string, userId: string): Promise<BuddyPairRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(buddyPairs)
        .where(
          and(
            eq(buddyPairs.id, id),
            eq(buddyPairs.status, "PENDING"),
            or(eq(buddyPairs.requesterId, userId), eq(buddyPairs.addresseeId, userId)),
          ),
        )
        .limit(1);
      return rows[0];
    });
  }

  async insertPending(requesterId: string, addresseeId: string): Promise<BuddyPairRow> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .insert(buddyPairs)
        .values({ requesterId, addresseeId, status: "PENDING" })
        .returning();
      return rows[0]!;
    });
  }

  /**
   * Accept in ONE tx: re-check neither party is ACTIVE elsewhere, flip to ACTIVE,
   * then delete every other PENDING row touching either party (they're paired now).
   * Returns false when the re-check fails (caller maps to 409).
   */
  async acceptInTx(pairId: string, requesterId: string, addresseeId: string): Promise<boolean> {
    return withServiceContext(this.db, async (tx) => {
      const partyActive = await tx
        .select({ id: buddyPairs.id })
        .from(buddyPairs)
        .where(
          and(
            eq(buddyPairs.status, "ACTIVE"),
            or(
              eq(buddyPairs.requesterId, requesterId),
              eq(buddyPairs.addresseeId, requesterId),
              eq(buddyPairs.requesterId, addresseeId),
              eq(buddyPairs.addresseeId, addresseeId),
            ),
          ),
        )
        .limit(1);
      if (partyActive.length > 0) return false;

      // The request may have been cancelled between the caller's read and this tx —
      // only proceed (and clean up other pendings) when the flip actually landed.
      const updated = await tx
        .update(buddyPairs)
        .set({ status: "ACTIVE", acceptedAt: new Date() })
        .where(and(eq(buddyPairs.id, pairId), eq(buddyPairs.status, "PENDING")))
        .returning({ id: buddyPairs.id });
      if (updated.length === 0) return false;
      await tx.delete(buddyPairs).where(
        and(
          ne(buddyPairs.id, pairId),
          eq(buddyPairs.status, "PENDING"),
          or(
            eq(buddyPairs.requesterId, requesterId),
            eq(buddyPairs.addresseeId, requesterId),
            eq(buddyPairs.requesterId, addresseeId),
            eq(buddyPairs.addresseeId, addresseeId),
          ),
        ),
      );
      return true;
    });
  }

  /** Delete a PENDING request where `userId` is a party (decline or cancel). */
  async deleteRequest(id: string, userId: string): Promise<void> {
    await withServiceContext(this.db, (tx) =>
      tx.delete(buddyPairs).where(
        and(
          eq(buddyPairs.id, id),
          eq(buddyPairs.status, "PENDING"),
          or(eq(buddyPairs.requesterId, userId), eq(buddyPairs.addresseeId, userId)),
        ),
      ),
    );
  }

  /** KVKK erasure: drop every pair the user is on either side of, any status. Idempotent. */
  async deleteAllForUser(userId: string): Promise<void> {
    await withServiceContext(this.db, (tx) =>
      tx
        .delete(buddyPairs)
        .where(or(eq(buddyPairs.requesterId, userId), eq(buddyPairs.addresseeId, userId))),
    );
  }

  /** End the user's ACTIVE pairing (no-op when none). */
  async deleteActive(userId: string): Promise<void> {
    await withServiceContext(this.db, (tx) =>
      tx.delete(buddyPairs).where(
        and(
          eq(buddyPairs.status, "ACTIVE"),
          or(eq(buddyPairs.requesterId, userId), eq(buddyPairs.addresseeId, userId)),
        ),
      ),
    );
  }

  /**
   * Of the given candidates, which must be excluded from buddy suggestions:
   * anyone already in a pair with the viewer (any direction/status), plus anyone
   * who already has an ACTIVE buddy (can't pair). One query; caller filters.
   */
  async listRelatedOrActivelyPairedIds(
    viewerId: string,
    candidateIds: string[],
  ): Promise<string[]> {
    if (candidateIds.length === 0) return [];
    const rows = await withServiceContext(this.db, (tx) =>
      tx
        .select({
          requesterId: buddyPairs.requesterId,
          addresseeId: buddyPairs.addresseeId,
          status: buddyPairs.status,
        })
        .from(buddyPairs)
        .where(
          or(
            eq(buddyPairs.requesterId, viewerId),
            eq(buddyPairs.addresseeId, viewerId),
            and(
              eq(buddyPairs.status, "ACTIVE"),
              or(
                inArray(buddyPairs.requesterId, candidateIds),
                inArray(buddyPairs.addresseeId, candidateIds),
              ),
            ),
          ),
        ),
    );
    const candidateSet = new Set(candidateIds);
    const excluded = new Set<string>();
    for (const r of rows) {
      if (r.requesterId === viewerId) excluded.add(r.addresseeId);
      else if (r.addresseeId === viewerId) excluded.add(r.requesterId);
      // ACTIVE rows not involving the viewer: exclude whichever side is a candidate.
      if (r.status === "ACTIVE") {
        if (candidateSet.has(r.requesterId)) excluded.add(r.requesterId);
        if (candidateSet.has(r.addresseeId)) excluded.add(r.addresseeId);
      }
    }
    return [...excluded];
  }

  /** Record a nudge timestamp on the side the acting user occupies. */
  async recordNudge(pairId: string, side: "requester" | "addressee", at: Date): Promise<void> {
    await withServiceContext(this.db, (tx) =>
      tx
        .update(buddyPairs)
        .set(side === "requester" ? { requesterLastNudgeAt: at } : { addresseeLastNudgeAt: at })
        .where(eq(buddyPairs.id, pairId)),
    );
  }

  /** Selection joining the other party's display fields (join target passed by caller). */
  private withOtherSelection(
    otherIdCol: typeof buddyPairs.requesterId | typeof buddyPairs.addresseeId,
  ) {
    return {
      id: buddyPairs.id,
      requesterId: buddyPairs.requesterId,
      addresseeId: buddyPairs.addresseeId,
      status: buddyPairs.status,
      acceptedAt: buddyPairs.acceptedAt,
      requesterLastNudgeAt: buddyPairs.requesterLastNudgeAt,
      addresseeLastNudgeAt: buddyPairs.addresseeLastNudgeAt,
      createdAt: buddyPairs.createdAt,
      otherUserId: otherIdCol,
      otherDisplayName: sql<string>`coalesce(${users.displayName}, '')`,
      otherUsername: users.username,
      otherAvatarStorageKey: users.avatarStorageKey,
    };
  }

  /** ACTIVE pair lookup with the OTHER party joined (other side depends on direction). */
  private async listWithOther(
    userId: string,
    statusCond: ReturnType<typeof eq>,
    limit: number,
  ): Promise<BuddyPairWithUserRow[]> {
    const otherId = sql<string>`case when ${buddyPairs.requesterId} = ${userId} then ${buddyPairs.addresseeId} else ${buddyPairs.requesterId} end`;
    return withServiceContext(this.db, (tx) =>
      tx
        .select({
          id: buddyPairs.id,
          requesterId: buddyPairs.requesterId,
          addresseeId: buddyPairs.addresseeId,
          status: buddyPairs.status,
          acceptedAt: buddyPairs.acceptedAt,
          requesterLastNudgeAt: buddyPairs.requesterLastNudgeAt,
          addresseeLastNudgeAt: buddyPairs.addresseeLastNudgeAt,
          createdAt: buddyPairs.createdAt,
          otherUserId: sql<string>`${users.id}`,
          otherDisplayName: sql<string>`coalesce(${users.displayName}, '')`,
          otherUsername: users.username,
          otherAvatarStorageKey: users.avatarStorageKey,
        })
        .from(buddyPairs)
        .innerJoin(users, eq(users.id, otherId))
        // No VISIBLE_USER filter here: hiding an ACTIVE pair with a banned partner would
        // strand the user in an invisible pairing (no card, no way to leave). Pending
        // lists DO filter; the banned partner simply can't be nudged into visibility.
        .where(
          and(
            statusCond,
            or(eq(buddyPairs.requesterId, userId), eq(buddyPairs.addresseeId, userId)),
          ),
        )
        .limit(limit),
    );
  }
}
