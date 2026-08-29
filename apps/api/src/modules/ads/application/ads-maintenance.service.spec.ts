import { describe, expect, it, vi } from "vitest";
import { AdsMaintenanceService } from "./ads-maintenance.service";

describe("AdsMaintenanceService", () => {
  it("runs a bounded expiry sweep when the protected cron invokes it", async () => {
    const expireDueSessions = vi.fn(async () => ({ expired: 2 }));
    const service = new AdsMaintenanceService({ expireDueSessions } as never);

    await expect(service.expireNow()).resolves.toEqual({ expired: 2 });

    expect(expireDueSessions).toHaveBeenCalledWith(200);
  });

  it("does not overlap two cron-triggered sweeps in the same process", async () => {
    let release: (() => void) | undefined;
    const expireDueSessions = vi.fn(() => new Promise<{ expired: number }>((resolve) => {
      release = () => resolve({ expired: 1 });
    }));
    const service = new AdsMaintenanceService({ expireDueSessions } as never);

    const first = service.expireNow();
    await expect(service.expireNow()).resolves.toEqual({ expired: 0 });
    release?.();

    await expect(first).resolves.toEqual({ expired: 1 });
    expect(expireDueSessions).toHaveBeenCalledTimes(1);
  });
});
