import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudyRoomSessionStarted } from "../../../coaching/domain/coaching.events";
import { StudyRoomActivityListener } from "./study-room-activity.listener";

const ACTOR = "u-actor";
const ROOM = "r1";

describe("StudyRoomActivityListener", () => {
  let notifications: { createInApp: ReturnType<typeof vi.fn> };
  let rooms: { getNotificationTargets: ReturnType<typeof vi.fn> };
  let usersRepo: { findByIdService: ReturnType<typeof vi.fn> };
  let deliveries: { tryRecord: ReturnType<typeof vi.fn> };
  let listener: StudyRoomActivityListener;

  const fakeDb = { transaction: (fn: (tx: unknown) => unknown) => fn({ execute: vi.fn() }) };

  beforeEach(() => {
    notifications = { createInApp: vi.fn(async () => undefined) };
    rooms = {
      getNotificationTargets: vi.fn(async () => ({
        roomName: "Sabah Kuşları",
        memberIds: ["u-b", "u-c"],
      })),
    };
    usersRepo = { findByIdService: vi.fn(async () => ({ displayName: "Ayşe" })) };
    deliveries = { tryRecord: vi.fn(async () => true) };
    listener = new StudyRoomActivityListener(
      notifications as never,
      rooms as never,
      usersRepo as never,
      deliveries as never,
      fakeDb as never,
    );
  });

  const fire = () => listener.onRoomSessionStarted(new StudyRoomSessionStarted(ACTOR, ROOM));

  it("tells every other member of the table, naming the actor and the room", async () => {
    await fire();

    expect(rooms.getNotificationTargets).toHaveBeenCalledWith(ROOM, ACTOR);
    expect(notifications.createInApp).toHaveBeenCalledTimes(2);
    for (const call of notifications.createInApp.mock.calls) {
      expect(["u-b", "u-c"]).toContain(call[0]);
      expect(call[3]).toContain("Ayşe");
      expect(call[3]).toContain("Sabah Kuşları");
      // Straight to the table, not the generic session screen.
      expect(call[4]).toBe(`/study-session/rooms/${ROOM}`);
    }
  });

  it("caps repeats: one notification per room, actor and day", async () => {
    await fire();
    const keys = deliveries.tryRecord.mock.calls.map((c) => c[1].dedupeKey as string);
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toContain(ROOM);
    expect(keys[0]).toContain(ACTOR);

    deliveries.tryRecord.mockResolvedValue(false); // second Pomodoro the same day
    notifications.createInApp.mockClear();
    await fire();
    expect(notifications.createInApp).not.toHaveBeenCalled();
  });

  it("stays quiet for a table with nobody else at it", async () => {
    rooms.getNotificationTargets.mockResolvedValue({ roomName: "Tek", memberIds: [] });
    await fire();
    expect(notifications.createInApp).not.toHaveBeenCalled();
  });

  it("stays quiet when the room vanished between the event and delivery", async () => {
    rooms.getNotificationTargets.mockResolvedValue(null);
    await fire();
    expect(notifications.createInApp).not.toHaveBeenCalled();
  });

  it("never lets a notification failure escape into the session start", async () => {
    notifications.createInApp.mockRejectedValue(new Error("db down"));
    await expect(fire()).resolves.toBeUndefined();

    rooms.getNotificationTargets.mockRejectedValue(new Error("db down"));
    await expect(fire()).resolves.toBeUndefined();
  });
});
