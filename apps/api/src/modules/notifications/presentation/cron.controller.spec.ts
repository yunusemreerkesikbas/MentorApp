import { describe, expect, it, vi } from "vitest";
import { CronController } from "./cron.controller";

describe("CronController.dispatchDailyReminders", () => {
  it("runs the waitlist KVKK purge with the daily trigger", async () => {
    const purge = () => ({ purgeExpired: vi.fn(async () => undefined) });
    const waitlist = purge();
    const controller = new CronController(
      {} as never,
      { dispatchForToday: vi.fn(async () => ({ sent: 0 })) } as never,
      {} as never,
      {} as never,
      {} as never,
      purge() as never,
      purge() as never,
      purge() as never,
      waitlist as never,
    );
    await expect(controller.dispatchDailyReminders()).resolves.toEqual({ sent: 0 });
    expect(waitlist.purgeExpired).toHaveBeenCalledTimes(1);
  });
});
