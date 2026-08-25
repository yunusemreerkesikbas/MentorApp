import { describe, expect, it, vi } from "vitest";
import { STUDY_ROOM_DORMANT_DAYS, STUDY_ROOM_QUOTA } from "@mentor/validation";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { StudyRoomService } from "./study-room.service";

const OWNER = "u-owner";
const MEMBER = "u-member";
const ROOM = "r1";

const roomRow = (over: Record<string, unknown> = {}) => ({
  id: ROOM,
  ownerUserId: OWNER,
  name: "Sabah Kuşları",
  theme: "LIBRARY",
  capacity: 6,
  inviteCode: "MASA-A1B2C3",
  visibility: "PRIVATE",
  lastActiveAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const memberRow = (userId: string, role: string, over: Record<string, unknown> = {}) => ({
  userId,
  role,
  joinedAt: new Date("2026-01-01T00:00:00Z"),
  displayName: userId === OWNER ? "Ayşe" : "Burak",
  username: userId === OWNER ? "ayse" : "burak",
  avatarStorageKey: null,
  ...over,
});

const makeRooms = () => ({
  createWithOwner: vi.fn().mockResolvedValue({ ok: true, room: roomRow() }),
  findById: vi.fn().mockResolvedValue(roomRow()),
  findByInviteCode: vi.fn().mockResolvedValue(undefined),
  listForUser: vi.fn().mockResolvedValue([]),
  listMembers: vi.fn().mockResolvedValue([memberRow(OWNER, "OWNER"), memberRow(MEMBER, "MEMBER")]),
  joinByCode: vi.fn().mockResolvedValue({ ok: true, room: roomRow() }),
  removeMember: vi.fn().mockResolvedValue({ removed: true, roomDeleted: false, newOwnerId: null }),
  removeMemberAsOwner: vi.fn().mockResolvedValue({ ok: true, removed: true }),
  updateRoom: vi.fn().mockResolvedValue({ ok: true, room: roomRow() }),
  setInviteCode: vi.fn().mockResolvedValue({ ok: true, room: roomRow() }),
  deleteRoom: vi.fn().mockResolvedValue({ ok: true }),
});

const makeSessions = (presence: unknown[] = []) => ({
  findRunningByRooms: vi.fn().mockResolvedValue(presence),
});

/** `withServiceContext` opens a tx; the service only forwards it, so a pass-through stands in. */
const fakeDb = { transaction: (fn: (tx: unknown) => unknown) => fn({ execute: vi.fn() }) };

const make = (over: { enabled?: boolean; presence?: unknown[] } = {}) => {
  const rooms = makeRooms();
  const sessions = makeSessions(over.presence ?? []);
  const config = { get: vi.fn().mockResolvedValue(over.enabled ?? true) };
  const storage = { getPublicUrl: (key: string) => `https://cdn/${key}` };
  const svc = new StudyRoomService(
    fakeDb as never,
    rooms as never,
    sessions as never,
    config as never,
    storage as never,
  );
  return { svc, rooms, sessions, config };
};

const expectDomainError = async (run: Promise<unknown>, code: string) => {
  await expect(run).rejects.toMatchObject({ code });
  await run.catch((err) => expect(err).toBeInstanceOf(DomainError));
};

describe("StudyRoomService", () => {
  describe("feature flag", () => {
    it("refuses every entry point while the flag is off", async () => {
      const { svc } = make({ enabled: false });
      await expectDomainError(svc.list(OWNER), ErrorCode.COACHING_ROOM_DISABLED);
      await expectDomainError(
        svc.create(OWNER, { name: "x", theme: "HOME", capacity: 4 }),
        ErrorCode.COACHING_ROOM_DISABLED,
      );
      await expectDomainError(svc.getDetail(OWNER, ROOM), ErrorCode.COACHING_ROOM_DISABLED);
    });
  });

  describe("create", () => {
    it("rejects a fourth active room", async () => {
      const { svc, rooms } = make();
      rooms.createWithOwner.mockResolvedValue({
        ok: false,
        reason: "quota_exceeded",
      });
      await expectDomainError(
        svc.create(OWNER, { name: "x", theme: "HOME", capacity: 4 }),
        ErrorCode.COACHING_ROOM_QUOTA_EXCEEDED,
      );
      expect(rooms.createWithOwner).toHaveBeenCalledTimes(1);
    });

    it("counts only non-dormant rooms against the quota", async () => {
      const { svc, rooms } = make();
      await svc.create(OWNER, { name: "x", theme: "HOME", capacity: 4 });
      expect(rooms.createWithOwner).toHaveBeenCalledWith(
        OWNER,
        expect.any(Object),
        { quota: STUDY_ROOM_QUOTA, dormantDays: STUDY_ROOM_DORMANT_DAYS },
      );
    });

    it("retries until it finds an unused invite code", async () => {
      const { svc, rooms } = make();
      rooms.findByInviteCode
        .mockResolvedValueOnce(roomRow())
        .mockResolvedValueOnce(roomRow())
        .mockResolvedValue(undefined);
      await svc.create(OWNER, { name: "x", theme: "HOME", capacity: 4 });
      expect(rooms.findByInviteCode).toHaveBeenCalledTimes(3);
      const code = rooms.createWithOwner.mock.calls[0]![1].inviteCode as string;
      expect(code).toMatch(/^MASA-[0-9A-F]{6}$/);
    });
  });

  describe("getDetail", () => {
    it("refuses a non-member", async () => {
      const { svc } = make();
      await expectDomainError(
        svc.getDetail("u-stranger", ROOM),
        ErrorCode.COACHING_ROOM_NOT_MEMBER,
      );
    });

    it("gives the invite code to the owner only", async () => {
      const { svc } = make();
      expect((await svc.getDetail(OWNER, ROOM)).inviteCode).toBe("MASA-A1B2C3");
      expect((await svc.getDetail(MEMBER, ROOM)).inviteCode).toBeNull();
    });

    it("marks only the member with an open session in THIS room as seated", async () => {
      const startedAt = new Date(Date.now() - 22 * 60_000);
      const { svc } = make({
        presence: [{ roomId: ROOM, userId: MEMBER, startedAt, subject: "Matematik" }],
      });
      const detail = await svc.getDetail(OWNER, ROOM);

      const owner = detail.seats.find((s) => s.userId === OWNER)!;
      const member = detail.seats.find((s) => s.userId === MEMBER)!;
      expect(owner.isSeated).toBe(false);
      expect(owner.seatedMinutes).toBeNull();
      expect(owner.subject).toBeNull();
      expect(member.isSeated).toBe(true);
      expect(member.seatedMinutes).toBe(22);
      expect(member.subject).toBe("Matematik");
      // memberCount vs activeCount — the "3/10" and "çalışan sayısı" of the design.
      expect(detail.memberCount).toBe(2);
      expect(detail.activeCount).toBe(1);
    });

    it("does not seat a member whose open session belongs to another room", async () => {
      const { svc } = make({
        presence: [
          { roomId: "other-room", userId: MEMBER, startedAt: new Date(), subject: null },
        ],
      });
      const detail = await svc.getDetail(OWNER, ROOM);
      expect(detail.seats.every((s) => !s.isSeated)).toBe(true);
      expect(detail.activeCount).toBe(0);
    });
  });

  describe("list", () => {
    it("reports dormant rooms as inactive", async () => {
      const { svc, rooms } = make();
      const dormantAt = new Date(Date.now() - (STUDY_ROOM_DORMANT_DAYS + 1) * 86_400_000);
      rooms.listForUser.mockResolvedValue([
        { ...roomRow(), role: "OWNER", memberCount: 2 },
        { ...roomRow({ id: "r2", lastActiveAt: dormantAt }), role: "MEMBER", memberCount: 1 },
      ]);
      const [fresh, dormant] = await svc.list(OWNER);
      expect(fresh!.isActive).toBe(true);
      expect(dormant!.isActive).toBe(false);
    });

    it("skips the presence query when the user has no rooms", async () => {
      const { svc, sessions } = make();
      expect(await svc.list(OWNER)).toEqual([]);
      expect(sessions.findRunningByRooms).not.toHaveBeenCalled();
    });
  });

  describe("join", () => {
    it.each([
      ["code_invalid", ErrorCode.COACHING_ROOM_CODE_INVALID],
      ["already_member", ErrorCode.COACHING_ROOM_ALREADY_MEMBER],
      ["full", ErrorCode.COACHING_ROOM_FULL],
      ["quota_exceeded", ErrorCode.COACHING_ROOM_QUOTA_EXCEEDED],
    ])("maps the %s outcome to its error code", async (reason, code) => {
      const { svc, rooms } = make();
      rooms.joinByCode.mockResolvedValue({ ok: false, reason });
      await expectDomainError(svc.join(MEMBER, { code: "MASA-A1B2C3" }), code);
    });
  });

  describe("owner-only actions", () => {
    it.each([
      [
        "updateRoom",
        (rooms: ReturnType<typeof makeRooms>) => rooms.updateRoom,
        (svc: StudyRoomService) => svc.update(MEMBER, ROOM, { name: "yeni" }),
      ],
      [
        "setInviteCode",
        (rooms: ReturnType<typeof makeRooms>) => rooms.setInviteCode,
        (svc: StudyRoomService) => svc.rotateInviteCode(MEMBER, ROOM),
      ],
      [
        "deleteRoom",
        (rooms: ReturnType<typeof makeRooms>) => rooms.deleteRoom,
        (svc: StudyRoomService) => svc.close(MEMBER, ROOM),
      ],
      [
        "removeMemberAsOwner",
        (rooms: ReturnType<typeof makeRooms>) => rooms.removeMemberAsOwner,
        (svc: StudyRoomService) => svc.removeMember(MEMBER, ROOM, OWNER),
      ],
    ])("refuses %s from a non-owner", async (_method, mutation, run) => {
      const { svc, rooms } = make();
      mutation(rooms).mockResolvedValue({ ok: false, reason: "not_owner" });
      await expectDomainError(run(svc), ErrorCode.COACHING_ROOM_NOT_OWNER);
    });

    it("rejects shrinking capacity below the member count", async () => {
      const { svc, rooms } = make();
      rooms.updateRoom.mockResolvedValue({ ok: false, reason: "capacity_below_members" });
      await expectDomainError(
        svc.update(OWNER, ROOM, { capacity: 2 }),
        ErrorCode.COACHING_ROOM_CAPACITY_BELOW_MEMBERS,
      );
    });

    it("routes an owner removing themselves through leave (succession applies)", async () => {
      const { svc, rooms } = make();
      await svc.removeMember(OWNER, ROOM, OWNER);
      expect(rooms.removeMember).toHaveBeenCalledTimes(1);
      expect(rooms.removeMember).toHaveBeenCalledWith(ROOM, OWNER);
    });
  });

  describe("leave", () => {
    it("404s when the user was not a member", async () => {
      const { svc, rooms } = make();
      rooms.removeMember.mockResolvedValue({
        removed: false,
        roomDeleted: false,
        newOwnerId: null,
      });
      await expectDomainError(svc.leave(MEMBER, ROOM), ErrorCode.COACHING_ROOM_NOT_MEMBER);
    });
  });
});
