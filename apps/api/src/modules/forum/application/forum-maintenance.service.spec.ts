import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForumMaintenanceService } from "./forum-maintenance.service";

const SIX_HOURS = 6 * 60 * 60 * 1000;

describe("ForumMaintenanceService", () => {
  let cleanupOrphanAttachments: ReturnType<typeof vi.fn>;
  let forumEnabled: boolean;

  const service = () =>
    new ForumMaintenanceService(
      { cleanupOrphanAttachments } as never,
      { get: async () => forumEnabled } as never,
    );

  beforeEach(() => {
    vi.useFakeTimers();
    forumEnabled = true;
    cleanupOrphanAttachments = vi.fn(async () => ({ deleted: 0 }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sweeps on its own interval — no cron registration required", async () => {
    const svc = service();
    svc.onModuleInit();

    expect(cleanupOrphanAttachments).not.toHaveBeenCalled(); // nothing on boot
    await vi.advanceTimersByTimeAsync(SIX_HOURS);
    expect(cleanupOrphanAttachments).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(SIX_HOURS);
    expect(cleanupOrphanAttachments).toHaveBeenCalledTimes(2);

    svc.onModuleDestroy();
  });

  it("skips the sweep while forum.enabled is off", async () => {
    forumEnabled = false;
    const svc = service();
    svc.onModuleInit();

    await vi.advanceTimersByTimeAsync(SIX_HOURS);
    expect(cleanupOrphanAttachments).not.toHaveBeenCalled();

    svc.onModuleDestroy();
  });

  it("swallows a sweep failure so the timer survives", async () => {
    const errorSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    cleanupOrphanAttachments.mockRejectedValueOnce(new Error("storage down"));
    const svc = service();
    svc.onModuleInit();

    await vi.advanceTimersByTimeAsync(SIX_HOURS);
    expect(errorSpy).toHaveBeenCalled();

    // Next tick still runs — a failed sweep must not kill maintenance.
    await vi.advanceTimersByTimeAsync(SIX_HOURS);
    expect(cleanupOrphanAttachments).toHaveBeenCalledTimes(2);

    svc.onModuleDestroy();
  });

  it("stops sweeping after module destroy", async () => {
    const svc = service();
    svc.onModuleInit();
    svc.onModuleDestroy();

    await vi.advanceTimersByTimeAsync(SIX_HOURS * 3);
    expect(cleanupOrphanAttachments).not.toHaveBeenCalled();
  });
});
