import { afterEach, describe, expect, it, vi } from "vitest";
import { DeliveryTemplate, JobName } from "../domain/notifications.constants";
import {
  buildSessionReturnLinkUrl,
  SessionReturnReminderService,
} from "./session-return-reminder.service";

describe("buildSessionReturnLinkUrl", () => {
  it("returns /seans without subject", () => {
    expect(buildSessionReturnLinkUrl()).toBe("/seans");
    expect(buildSessionReturnLinkUrl(null)).toBe("/seans");
    expect(buildSessionReturnLinkUrl("  ")).toBe("/seans");
  });

  it("encodes subject query", () => {
    expect(buildSessionReturnLinkUrl("Matematik")).toBe("/seans?subject=Matematik");
    expect(buildSessionReturnLinkUrl("A & B")).toBe("/seans?subject=A%20%26%20B");
  });
});

describe("SessionReturnReminderService", () => {
  afterEach(() => vi.restoreAllMocks());

  const USER = "11111111-1111-1111-1111-111111111111";
  const db = {
    transaction: async <T>(cb: (tx: unknown) => Promise<T>) =>
      cb({ execute: async () => undefined }),
  } as never;

  it("enqueues job when schedule dedupe inserts", async () => {
    const tryRecord = vi.fn().mockResolvedValue(true);
    const enqueue = vi.fn().mockResolvedValue({ jobId: "j1" });
    const service = new SessionReturnReminderService(
      db,
      { enqueue } as never,
      { tryRecord } as never,
    );
    const now = new Date("2026-07-12T10:00:00.000Z");
    const res = await service.schedule(USER, { subject: "Tarih" }, now);

    expect(res.scheduled).toBe(true);
    expect(res.alreadyScheduled).toBe(false);
    expect(res.runAt).toBe("2026-07-13T10:00:00.000Z");
    expect(tryRecord).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: USER,
        channel: "SCHEDULE",
        template: DeliveryTemplate.SESSION_RETURN,
        dedupeKey: "session-return:2026-07-13",
      }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      JobName.SESSION_RETURN_REMINDER,
      {
        userId: USER,
        linkUrl: "/seans?subject=Tarih",
        subject: "Tarih",
        targetDate: "2026-07-13",
      },
      { runAt: new Date("2026-07-13T10:00:00.000Z") },
    );
  });

  it("returns alreadyScheduled when dedupe hits", async () => {
    const tryRecord = vi.fn().mockResolvedValue(false);
    const enqueue = vi.fn();
    const service = new SessionReturnReminderService(
      db,
      { enqueue } as never,
      { tryRecord } as never,
    );
    const res = await service.schedule(USER, {}, new Date("2026-07-12T10:00:00.000Z"));

    expect(res).toEqual({ scheduled: false, alreadyScheduled: true, runAt: null });
    expect(enqueue).not.toHaveBeenCalled();
  });
});
