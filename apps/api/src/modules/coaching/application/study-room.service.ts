import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type {
  CreateStudyRoomInput,
  JoinStudyRoomInput,
  UpdateStudyRoomInput,
} from "@mentor/validation";
import { STUDY_ROOM_DORMANT_DAYS, STUDY_ROOM_QUOTA } from "@mentor/validation";
import type {
  StudyRoomDetailDto,
  StudyRoomDto,
  StudyRoomRole,
  StudyRoomSeatDto,
  StudyRoomTheme,
} from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";
import { ACTIVE_SESSION_GRACE_MINUTES } from "../domain/coaching.constants";
import {
  StudySessionRepository,
  type RoomPresenceRow,
} from "../infrastructure/study-session.repository";
import {
  StudyRoomRepository,
  type StudyRoomMemberWithUserRow,
  type StudyRoomRow,
} from "../infrastructure/study-room.repository";

/** `MASA-` + 6 uppercase hex chars — short enough to read aloud, sparse enough not to collide. */
const genInviteCode = (): string => `MASA-${randomBytes(3).toString("hex").toUpperCase()}`;
const CODE_ATTEMPTS = 5;

/**
 * Study rooms ("masa") — persistent, themed, invite-code tables people co-work at.
 *
 * Body-doubling only: every member keeps their own Pomodoro (the timer is untouched), and the
 * room contributes the shared ground plus a "who is focusing right now" signal. Effort only —
 * seats show focus minutes and subject, never exam results (§4). No chat, no reactions, no
 * economy hook (rooms grant no coin and no bonus XP — roadmap §106).
 *
 * Presence is derived from `study_sessions.room_id`, so there is no heartbeat, socket or Redis:
 * one indexed query per room view, polled by the client.
 */
@Injectable()
export class StudyRoomService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly rooms: StudyRoomRepository,
    private readonly sessions: StudySessionRepository,
    private readonly config: ConfigRegistryService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  /** Every room entry point passes through the flag — a disabled feature must not be reachable. */
  async assertEnabled(): Promise<void> {
    const enabled = await this.config.get(FeatureFlag.STUDY_ROOMS_ENABLED);
    if (!enabled) {
      throw new DomainError(ErrorCode.COACHING_ROOM_DISABLED, HttpStatus.FORBIDDEN);
    }
  }

  async create(userId: string, input: CreateStudyRoomInput): Promise<StudyRoomDetailDto> {
    await this.assertEnabled();
    const active = await this.rooms.countActiveMembershipsForUser(
      userId,
      STUDY_ROOM_DORMANT_DAYS,
    );
    if (active >= STUDY_ROOM_QUOTA) {
      throw new DomainError(ErrorCode.COACHING_ROOM_QUOTA_EXCEEDED, HttpStatus.CONFLICT);
    }
    const room = await this.rooms.createWithOwner(userId, {
      name: input.name,
      theme: input.theme,
      capacity: input.capacity,
      inviteCode: await this.reserveCode(),
    });
    return this.getDetail(userId, room.id);
  }

  /** "Masalarım" — one presence query covers every room in the list. */
  async list(userId: string): Promise<StudyRoomDto[]> {
    await this.assertEnabled();
    const rows = await this.rooms.listForUser(userId);
    if (rows.length === 0) return [];
    const presence = await this.loadPresence(rows.map((r) => r.id));
    return rows.map((row) =>
      this.toRoomDto(row, row.role as StudyRoomRole, row.memberCount, presence),
    );
  }

  async getDetail(userId: string, roomId: string): Promise<StudyRoomDetailDto> {
    await this.assertEnabled();
    const room = await this.requireRoom(roomId);
    const members = await this.rooms.listMembers(roomId);
    const self = members.find((m) => m.userId === userId);
    if (!self) throw new DomainError(ErrorCode.COACHING_ROOM_NOT_MEMBER, HttpStatus.FORBIDDEN);

    const presence = await this.loadPresence([roomId]);
    const seats = members.map((m) => this.toSeatDto(m, presence.get(seatKey(roomId, m.userId))));
    const role = self.role as StudyRoomRole;
    return {
      ...this.toRoomDto(room, role, members.length, presence),
      // Members share the room, not the ability to re-invite — the code stays with the owner.
      inviteCode: role === "OWNER" ? room.inviteCode : null,
      seats,
    };
  }

  async join(userId: string, input: JoinStudyRoomInput): Promise<StudyRoomDetailDto> {
    await this.assertEnabled();
    const result = await this.rooms.joinByCode(userId, input.code, {
      quota: STUDY_ROOM_QUOTA,
      dormantDays: STUDY_ROOM_DORMANT_DAYS,
    });
    if (!result.ok) throw joinError(result.reason);
    return this.getDetail(userId, result.room.id);
  }

  async update(
    userId: string,
    roomId: string,
    patch: UpdateStudyRoomInput,
  ): Promise<StudyRoomDetailDto> {
    await this.assertEnabled();
    await this.requireOwner(userId, roomId);
    const result = await this.rooms.updateRoom(roomId, patch);
    if (!result.ok) {
      throw new DomainError(
        ErrorCode.COACHING_ROOM_CAPACITY_BELOW_MEMBERS,
        HttpStatus.CONFLICT,
      );
    }
    return this.getDetail(userId, roomId);
  }

  /** Rotate a leaked code. Memberships are unaffected — they hang off rows, not the code. */
  async rotateInviteCode(userId: string, roomId: string): Promise<StudyRoomDetailDto> {
    await this.assertEnabled();
    await this.requireOwner(userId, roomId);
    await this.rooms.setInviteCode(roomId, await this.reserveCode());
    return this.getDetail(userId, roomId);
  }

  /** Leave. Owner leaving hands the room to the earliest member; the last one out closes it. */
  async leave(userId: string, roomId: string): Promise<void> {
    await this.assertEnabled();
    const result = await this.rooms.removeMember(roomId, userId);
    if (!result.removed) {
      throw new DomainError(ErrorCode.COACHING_ROOM_NOT_MEMBER, HttpStatus.NOT_FOUND);
    }
  }

  /**
   * Owner removes a member. v1 has no ban list — a removed member can rejoin with the same
   * code, so the owner should rotate the code too. (Bans arrive with Phase-2 public rooms,
   * where strangers make them necessary.)
   */
  async removeMember(userId: string, roomId: string, targetUserId: string): Promise<void> {
    await this.assertEnabled();
    await this.requireOwner(userId, roomId);
    if (targetUserId === userId) {
      // Removing yourself is "leave" — it carries succession semantics the owner path lacks.
      await this.leave(userId, roomId);
      return;
    }
    const result = await this.rooms.removeMember(roomId, targetUserId);
    if (!result.removed) {
      throw new DomainError(ErrorCode.COACHING_ROOM_NOT_MEMBER, HttpStatus.NOT_FOUND);
    }
  }

  async close(userId: string, roomId: string): Promise<void> {
    await this.assertEnabled();
    await this.requireOwner(userId, roomId);
    // Memberships cascade; past sessions keep their history and lose only the room label.
    await this.rooms.deleteRoom(roomId);
  }

  // --- internals -------------------------------------------------------------

  private async requireRoom(roomId: string): Promise<StudyRoomRow> {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new DomainError(ErrorCode.COACHING_ROOM_NOT_FOUND, HttpStatus.NOT_FOUND);
    return room;
  }

  private async requireOwner(userId: string, roomId: string): Promise<StudyRoomRow> {
    const room = await this.requireRoom(roomId);
    if (room.ownerUserId !== userId) {
      throw new DomainError(ErrorCode.COACHING_ROOM_NOT_OWNER, HttpStatus.FORBIDDEN);
    }
    return room;
  }

  /** Unique code with a bounded retry — same shape as the referral invite generator. */
  private async reserveCode(): Promise<string> {
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      const code = genInviteCode();
      if (!(await this.rooms.findByInviteCode(code))) return code;
    }
    throw new DomainError(ErrorCode.INTERNAL_ERROR, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  /** `roomId:userId` → the open session seating that member. One query for the whole view. */
  private async loadPresence(roomIds: string[]): Promise<Map<string, RoomPresenceRow>> {
    const rows = await withServiceContext(this.db, (tx) =>
      this.sessions.findRunningByRooms(tx, roomIds, ACTIVE_SESSION_GRACE_MINUTES),
    );
    return new Map(rows.map((row) => [seatKey(row.roomId, row.userId), row]));
  }

  private toRoomDto(
    room: StudyRoomRow,
    role: StudyRoomRole,
    memberCount: number,
    presence: Map<string, RoomPresenceRow>,
    ): StudyRoomDto {
    let activeCount = 0;
    for (const row of presence.values()) if (row.roomId === room.id) activeCount++;
    return {
      id: room.id,
      name: room.name,
      theme: room.theme as StudyRoomTheme,
      capacity: room.capacity,
      memberCount,
      activeCount,
      role,
      isActive: isWithinDormancy(room.lastActiveAt),
    };
  }

  private toSeatDto(
    member: StudyRoomMemberWithUserRow,
    seated: RoomPresenceRow | undefined,
  ): StudyRoomSeatDto {
    return {
      userId: member.userId,
      displayName: member.displayName,
      username: member.username,
      avatarUrl: member.avatarStorageKey
        ? this.storage.getPublicUrl(member.avatarStorageKey)
        : null,
      role: member.role as StudyRoomRole,
      isSeated: seated !== undefined,
      seatedMinutes: seated
        ? Math.max(0, Math.floor((Date.now() - seated.startedAt.getTime()) / 60_000))
        : null,
      subject: seated?.subject ?? null,
    };
  }
}

const seatKey = (roomId: string, userId: string): string => `${roomId}:${userId}`;

function isWithinDormancy(lastActiveAt: Date): boolean {
  const cutoff = Date.now() - STUDY_ROOM_DORMANT_DAYS * 24 * 60 * 60 * 1000;
  return lastActiveAt.getTime() > cutoff;
}

function joinError(reason: "code_invalid" | "already_member" | "full" | "quota_exceeded") {
  switch (reason) {
    case "code_invalid":
      return new DomainError(ErrorCode.COACHING_ROOM_CODE_INVALID, HttpStatus.NOT_FOUND);
    case "already_member":
      return new DomainError(ErrorCode.COACHING_ROOM_ALREADY_MEMBER, HttpStatus.CONFLICT);
    case "full":
      return new DomainError(ErrorCode.COACHING_ROOM_FULL, HttpStatus.CONFLICT);
    case "quota_exceeded":
      return new DomainError(ErrorCode.COACHING_ROOM_QUOTA_EXCEEDED, HttpStatus.CONFLICT);
  }
}
