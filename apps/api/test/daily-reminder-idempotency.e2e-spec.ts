import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabase, createPool } from "../src/database/drizzle";
import { withServiceContext } from "../src/database/rls";
import { userNotifications, users } from "../src/database/schema";
import { DailyReminderService } from "../src/modules/notifications/application/daily-reminder.service";
import { NotificationsService } from "../src/modules/notifications/application/notifications.service";
import { UserNotificationRepository } from "../src/modules/notifications/infrastructure/user-notification.repository";

describe("daily inbox reminder idempotency (PostgreSQL)", () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Explicit isolated TEST_DATABASE_URL required.");
  const pool = createPool(url);
  const db = createDatabase(pool);
  let userId: string;
  const realtime = vi.fn();
  const preferences = { findByUserIdService: async () => ({ emailEnabled: false, pushEnabled: false }) };
  const queue = { enqueue: async () => { throw new Error("External delivery must remain disabled."); } };
  const notifications = new NotificationsService(
    db, {} as never, preferences as never, new UserNotificationRepository(), {} as never,
    { resolve: () => ({ title: "Günlük hatırlatma", body: "Birlikte devam edelim." }) } as never,
    { pushRealtimeEvent: realtime } as never, {} as never, {} as never, queue as never,
  );
  const daily = new DailyReminderService(
    db, queue as never,
    { listDailyReminderCandidates: async () => [{ userId, email: "reminder@fixture.test", displayName: "Test" }] } as never,
    preferences as never, {} as never, notifications, { get: async () => false } as never,
  );
  const rows = () => withServiceContext(db, (tx) => tx.select().from(userNotifications).where(eq(userNotifications.userId, userId)));

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-29T09:00:00Z"));
    realtime.mockClear();
    userId = randomUUID();
    await withServiceContext(db, (tx) => tx.insert(users).values({
      id: userId, email: `${userId}@fixture.test`, displayName: "Test", passwordHash: "fixture-only",
      kvkkAcceptedAt: new Date(),
    }));
  });
  afterEach(async () => {
    vi.useRealTimers();
    await withServiceContext(db, async (tx) => {
      await tx.delete(userNotifications).where(eq(userNotifications.userId, userId));
      await tx.delete(users).where(eq(users.id, userId));
    });
  });
  afterAll(() => pool.end());

  it("keeps one inbox row and realtime event when the same day is retried", async () => {
    await daily.dispatchForToday();
    await daily.dispatchForToday();
    expect(await rows()).toHaveLength(1);
    expect(realtime).toHaveBeenCalledTimes(1);
  });

  it("keeps one inbox row when two triggers race", async () => {
    await Promise.all([daily.dispatchForToday(), daily.dispatchForToday()]);
    expect(await rows()).toHaveLength(1);
  });

  it("allows the next day's reminder after deduping today", async () => {
    await daily.dispatchForToday();
    await daily.dispatchForToday();
    vi.setSystemTime(new Date("2026-10-30T09:00:00Z"));
    await daily.dispatchForToday();
    expect(await rows()).toHaveLength(2);
  });
});
