import { describe, expect, it, vi } from "vitest";
import { AchievementEventsListener } from "./achievement-events.listener";

const event = {
  userId: "user-1",
  username: "ayse",
  achievementId: "first_step" as const,
  source: "LIVE" as const,
};

describe("AchievementEventsListener", () => {
  it("creates one deduped notification and one realtime signal for a new live award", async () => {
    const notifications = {
      createInApp: vi.fn().mockResolvedValue(true),
      pushRealtimeEvent: vi.fn(),
    };
    const listener = new AchievementEventsListener(notifications as never);
    await listener.onAwarded(event);
    expect(notifications.createInApp).toHaveBeenCalledWith(
      "user-1",
      "ACHIEVEMENT",
      expect.any(String),
      expect.any(String),
      "/community/member/ayse?tab=achievements",
      expect.objectContaining({ dedupeKey: "achievement:first_step:v1" }),
    );
    expect(notifications.pushRealtimeEvent).toHaveBeenCalledTimes(1);
  });

  it("does not signal when dedupe prevents a second notification", async () => {
    const notifications = {
      createInApp: vi.fn().mockResolvedValue(false),
      pushRealtimeEvent: vi.fn(),
    };
    const listener = new AchievementEventsListener(notifications as never);
    await listener.onAwarded(event);
    expect(notifications.pushRealtimeEvent).not.toHaveBeenCalled();
  });

  it("ignores backfill awards", async () => {
    const notifications = { createInApp: vi.fn(), pushRealtimeEvent: vi.fn() };
    const listener = new AchievementEventsListener(notifications as never);
    await listener.onAwarded({ ...event, source: "BACKFILL" });
    expect(notifications.createInApp).not.toHaveBeenCalled();
  });
});
