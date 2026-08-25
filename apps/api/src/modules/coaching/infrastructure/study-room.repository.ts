import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { studyRoomMembers, studyRooms, users } from "../../../database/schema";

export type StudyRoomRow = typeof studyRooms.$inferSelect;
export type StudyRoomMemberRow = typeof studyRoomMembers.$inferSelect;

/** A room row plus the viewer's own role and the counts the list card needs. */
export interface StudyRoomWithMembershipRow extends StudyRoomRow {
  role: string;
  memberCount: number;
}

/** A membership joined with the member's public display fields. */
export interface StudyRoomMemberWithUserRow {
  userId: string;
  role: string;
  joinedAt: Date;
  displayName: string;
  username: string | null;
  avatarStorageKey: string | null;
}

const VISIBLE_USER = sql`${users.status} not in ('BANNED', 'SUSPENDED')`;

/**
 * Study rooms + memberships. Runs in SERVICE context, scoped by explicit WHERE clauses and
 * protected by service-only RLS. Room rows are cross-user by nature; caller authorization still
 * belongs to the repository transaction rather than a self-only database policy.
 *
 * Anything that must not race — join (capacity + quota), leave (ownership succession) — takes
 * a `select … for update` lock on the room row inside a single transaction.
 */
@Injectable()
export class StudyRoomRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Create the room and seat its owner in one transaction. */
  async createWithOwner(
    ownerUserId: string,
    data: { name: string; theme: string; capacity: number; inviteCode: string },
    opts: { quota: number; dormantDays: number },
  ): Promise<
    | { ok: true; room: StudyRoomRow }
    | { ok: false; reason: "quota_exceeded" }
  > {
    return withServiceContext(this.db, async (tx) => {
      await this.lockUserQuota(tx, ownerUserId);
      if ((await this.countActiveMemberships(tx, ownerUserId, opts.dormantDays)) >= opts.quota) {
        return { ok: false as const, reason: "quota_exceeded" as const };
      }
      const rows = await tx
        .insert(studyRooms)
        .values({ ownerUserId, ...data })
        .returning();
      const room = rows[0]!;
      await tx
        .insert(studyRoomMembers)
        .values({ roomId: room.id, userId: ownerUserId, role: "OWNER" });
      return { ok: true as const, room };
    });
  }

  findById(roomId: string): Promise<StudyRoomRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx.select().from(studyRooms).where(eq(studyRooms.id, roomId)).limit(1);
      return rows[0];
    });
  }

  findByInviteCode(code: string): Promise<StudyRoomRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(studyRooms)
        .where(eq(studyRooms.inviteCode, code))
        .limit(1);
      return rows[0];
    });
  }

  /** Rooms the user belongs to, newest membership first, with the persistent member count. */
  listForUser(userId: string): Promise<StudyRoomWithMembershipRow[]> {
    return withServiceContext(this.db, (tx) => this.selectForUser(tx, userId));
  }

  /** Seat list for one room: every member with display fields, succession order. */
  listMembers(roomId: string): Promise<StudyRoomMemberWithUserRow[]> {
    return withServiceContext(this.db, (tx) =>
      tx
        .select({
          userId: studyRoomMembers.userId,
          role: studyRoomMembers.role,
          joinedAt: studyRoomMembers.joinedAt,
          displayName: users.displayName,
          username: users.username,
          avatarStorageKey: users.avatarStorageKey,
        })
        .from(studyRoomMembers)
        .innerJoin(users, eq(users.id, studyRoomMembers.userId))
        .where(and(eq(studyRoomMembers.roomId, roomId), VISIBLE_USER))
        .orderBy(asc(studyRoomMembers.joinedAt)),
    );
  }

  findMembership(roomId: string, userId: string): Promise<StudyRoomMemberRow | undefined> {
    return withServiceContext(this.db, (tx) => this.selectMembership(tx, roomId, userId));
  }

  /**
   * Join by code: locks the room, then re-checks quota, membership and capacity inside the
   * lock so two people racing for the last seat can't both get it. Returns why it failed
   * instead of throwing — the service owns the error mapping.
   */
  async joinByCode(
    userId: string,
    code: string,
    opts: { quota: number; dormantDays: number },
  ): Promise<
    | { ok: true; room: StudyRoomRow }
    | { ok: false; reason: "code_invalid" | "already_member" | "full" | "quota_exceeded" }
  > {
    return withServiceContext(this.db, async (tx) => {
      await this.lockUserQuota(tx, userId);
      const locked = await tx
        .select()
        .from(studyRooms)
        .where(eq(studyRooms.inviteCode, code))
        .limit(1)
        .for("update");
      const room = locked[0];
      if (!room) return { ok: false as const, reason: "code_invalid" as const };

      if (await this.selectMembership(tx, room.id, userId)) {
        return { ok: false as const, reason: "already_member" as const };
      }
      if ((await this.countActiveMemberships(tx, userId, opts.dormantDays)) >= opts.quota) {
        return { ok: false as const, reason: "quota_exceeded" as const };
      }
      if ((await this.countMembers(tx, room.id)) >= room.capacity) {
        return { ok: false as const, reason: "full" as const };
      }

      await tx.insert(studyRoomMembers).values({ roomId: room.id, userId, role: "MEMBER" });
      return { ok: true as const, room };
    });
  }

  /**
   * Remove a member. When the owner leaves, ownership passes to the earliest remaining member;
   * when the last member leaves, the room is deleted. Reports what happened so the service can
   * tell the caller (and, later, notify).
   */
  async removeMember(
    roomId: string,
    userId: string,
  ): Promise<{ removed: boolean; roomDeleted: boolean; newOwnerId: string | null }> {
    return withServiceContext(this.db, async (tx) => {
      await tx.select().from(studyRooms).where(eq(studyRooms.id, roomId)).limit(1).for("update");

      const membership = await this.selectMembership(tx, roomId, userId);
      if (!membership) return { removed: false, roomDeleted: false, newOwnerId: null };

      await tx
        .delete(studyRoomMembers)
        .where(and(eq(studyRoomMembers.roomId, roomId), eq(studyRoomMembers.userId, userId)));

      if (membership.role !== "OWNER") {
        return { removed: true, roomDeleted: false, newOwnerId: null };
      }

      const successors = await tx
        .select({ userId: studyRoomMembers.userId })
        .from(studyRoomMembers)
        .where(eq(studyRoomMembers.roomId, roomId))
        .orderBy(asc(studyRoomMembers.joinedAt))
        .limit(1);
      const successor = successors[0];
      if (!successor) {
        await tx.delete(studyRooms).where(eq(studyRooms.id, roomId));
        return { removed: true, roomDeleted: true, newOwnerId: null };
      }

      await tx
        .update(studyRoomMembers)
        .set({ role: "OWNER" })
        .where(
          and(
            eq(studyRoomMembers.roomId, roomId),
            eq(studyRoomMembers.userId, successor.userId),
          ),
        );
      await tx
        .update(studyRooms)
        .set({ ownerUserId: successor.userId, updatedAt: new Date() })
        .where(eq(studyRooms.id, roomId));
      return { removed: true, roomDeleted: false, newOwnerId: successor.userId };
    });
  }

  /** Owner edit. Capacity is re-checked against the live member count under the room lock. */
  async updateRoom(
    actorUserId: string,
    roomId: string,
    patch: { name?: string; theme?: string; capacity?: number },
  ): Promise<
    | { ok: true; room: StudyRoomRow }
    | { ok: false; reason: "not_found" | "not_owner" | "capacity_below_members" }
  > {
    return withServiceContext(this.db, async (tx) => {
      const room = await this.lockRoom(tx, roomId);
      if (!room) return { ok: false as const, reason: "not_found" as const };
      if (room.ownerUserId !== actorUserId) {
        return { ok: false as const, reason: "not_owner" as const };
      }
      if (patch.capacity !== undefined) {
        const members = await this.countMembers(tx, roomId);
        if (patch.capacity < members) {
          return { ok: false as const, reason: "capacity_below_members" as const };
        }
      }
      const rows = await tx
        .update(studyRooms)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(studyRooms.id, roomId))
        .returning();
      return { ok: true as const, room: rows[0]! };
    });
  }

  async setInviteCode(
    actorUserId: string,
    roomId: string,
    inviteCode: string,
  ): Promise<
    | { ok: true; room: StudyRoomRow }
    | { ok: false; reason: "not_found" | "not_owner" }
  > {
    return withServiceContext(this.db, async (tx) => {
      const room = await this.lockRoom(tx, roomId);
      if (!room) return { ok: false as const, reason: "not_found" as const };
      if (room.ownerUserId !== actorUserId) {
        return { ok: false as const, reason: "not_owner" as const };
      }
      const rows = await tx
        .update(studyRooms)
        .set({ inviteCode, updatedAt: new Date() })
        .where(eq(studyRooms.id, roomId))
        .returning();
      return { ok: true as const, room: rows[0]! };
    });
  }

  async removeMemberAsOwner(
    actorUserId: string,
    roomId: string,
    targetUserId: string,
  ): Promise<
    | { ok: true; removed: boolean }
    | { ok: false; reason: "not_found" | "not_owner" }
  > {
    return withServiceContext(this.db, async (tx) => {
      const room = await this.lockRoom(tx, roomId);
      if (!room) return { ok: false as const, reason: "not_found" as const };
      if (room.ownerUserId !== actorUserId) {
        return { ok: false as const, reason: "not_owner" as const };
      }
      const deleted = await tx
        .delete(studyRoomMembers)
        .where(
          and(
            eq(studyRoomMembers.roomId, roomId),
            eq(studyRoomMembers.userId, targetUserId),
          ),
        )
        .returning({ id: studyRoomMembers.id });
      return { ok: true as const, removed: deleted.length > 0 };
    });
  }

  async deleteRoom(
    actorUserId: string,
    roomId: string,
  ): Promise<{ ok: true } | { ok: false; reason: "not_found" | "not_owner" }> {
    return withServiceContext(this.db, async (tx) => {
      const room = await this.lockRoom(tx, roomId);
      if (!room) return { ok: false as const, reason: "not_found" as const };
      if (room.ownerUserId !== actorUserId) {
        return { ok: false as const, reason: "not_owner" as const };
      }
      await tx.delete(studyRooms).where(eq(studyRooms.id, roomId));
      return { ok: true as const };
    });
  }

  /** Bump the dormancy anchor when a member sits down (called from the session start tx). */
  async touchLastActive(tx: DatabaseTx, roomId: string): Promise<void> {
    await tx
      .update(studyRooms)
      .set({ lastActiveAt: new Date() })
      .where(eq(studyRooms.id, roomId));
  }

  /** Membership probe used by session start; takes the caller's tx so start stays one round trip. */
  async isMember(tx: DatabaseTx, roomId: string, userId: string): Promise<boolean> {
    const rows = await tx
      .select({ id: studyRoomMembers.id })
      .from(studyRoomMembers)
      .where(and(eq(studyRoomMembers.roomId, roomId), eq(studyRoomMembers.userId, userId)))
      .limit(1);
    return rows.length > 0;
  }

  /**
   * KVKK erasure: membership rows are relational PII ("who studies with whom"), so they are
   * hard-deleted. Rooms the user owned pass to the earliest remaining member; rooms left with
   * nobody are deleted. Idempotent.
   */
  async deleteAllForUser(userId: string): Promise<void> {
    const owned = await withServiceContext(this.db, (tx) =>
      tx
        .select({ id: studyRooms.id })
        .from(studyRooms)
        .where(eq(studyRooms.ownerUserId, userId)),
    );
    for (const room of owned) {
      await this.removeMember(room.id, userId);
    }
    await withServiceContext(this.db, (tx) =>
      tx.delete(studyRoomMembers).where(eq(studyRoomMembers.userId, userId)),
    );
  }

  // --- internals -------------------------------------------------------------

  private async selectMembership(
    tx: DatabaseTx,
    roomId: string,
    userId: string,
  ): Promise<StudyRoomMemberRow | undefined> {
    const rows = await tx
      .select()
      .from(studyRoomMembers)
      .where(and(eq(studyRoomMembers.roomId, roomId), eq(studyRoomMembers.userId, userId)))
      .limit(1);
    return rows[0];
  }

  private async countMembers(tx: DatabaseTx, roomId: string): Promise<number> {
    const rows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(studyRoomMembers)
      .where(eq(studyRoomMembers.roomId, roomId));
    return rows[0]?.count ?? 0;
  }

  /** Quota counts ACTIVE memberships only — a dormant room must not block a new one. */
  private async countActiveMemberships(
    tx: DatabaseTx,
    userId: string,
    dormantDays: number,
  ): Promise<number> {
    const rows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(studyRoomMembers)
      .innerJoin(studyRooms, eq(studyRooms.id, studyRoomMembers.roomId))
      .where(
        and(
          eq(studyRoomMembers.userId, userId),
          sql`${studyRooms.lastActiveAt} > now() - ${dormantDays} * interval '1 day'`,
        ),
      );
    return rows[0]?.count ?? 0;
  }

  private async lockUserQuota(tx: DatabaseTx, userId: string): Promise<void> {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`,
    );
  }

  private async lockRoom(
    tx: DatabaseTx,
    roomId: string,
  ): Promise<StudyRoomRow | undefined> {
    const rows = await tx
      .select()
      .from(studyRooms)
      .where(eq(studyRooms.id, roomId))
      .limit(1)
      .for("update");
    return rows[0];
  }

  private selectForUser(tx: DatabaseTx, userId: string): Promise<StudyRoomWithMembershipRow[]> {
    const memberCount = sql<number>`(
      select count(*)::int from ${studyRoomMembers} m2 where m2.room_id = ${studyRooms.id}
    )`;
    return tx
      .select({
        ...getStudyRoomColumns(),
        role: studyRoomMembers.role,
        memberCount,
      })
      .from(studyRoomMembers)
      .innerJoin(studyRooms, eq(studyRooms.id, studyRoomMembers.roomId))
      .where(eq(studyRoomMembers.userId, userId))
      .orderBy(ne(studyRoomMembers.role, "OWNER"), asc(studyRoomMembers.joinedAt));
  }
}

function getStudyRoomColumns() {
  return {
    id: studyRooms.id,
    ownerUserId: studyRooms.ownerUserId,
    name: studyRooms.name,
    theme: studyRooms.theme,
    capacity: studyRooms.capacity,
    inviteCode: studyRooms.inviteCode,
    visibility: studyRooms.visibility,
    lastActiveAt: studyRooms.lastActiveAt,
    createdAt: studyRooms.createdAt,
    updatedAt: studyRooms.updatedAt,
  };
}
