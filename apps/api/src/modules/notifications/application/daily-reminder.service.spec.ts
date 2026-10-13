import { afterEach, describe, expect, it, vi } from "vitest";
import { CONFIG_CATALOG } from "../../../common/config/config.catalog";
import { EmailTemplate, JobName } from "../../../shared/notifications/constants";
import { DailyReminderService } from "./daily-reminder.service";

describe("DailyReminderService", () => {
  afterEach(() => vi.restoreAllMocks());

  const db = {
    transaction: async <T>(cb: (tx: unknown) => Promise<T>) =>
      cb({ execute: async () => undefined }),
  } as never;

  function makeService(overrides: {
    candidates?: Array<{ userId: string; email: string; displayName: string }>;
    emailEnabled?: boolean;
    pushEnabled?: boolean;
    emailDedupeOk?: boolean;
    dailyEmailEnabled?: boolean;
  } = {}) {
    const coaching = {
      listDailyReminderCandidates: vi.fn().mockResolvedValue(
        overrides.candidates ?? [
          { userId: "u1", email: "a@test.local", displayName: "Ada" },
        ],
      ),
    };
    const queue = { enqueue: vi.fn().mockResolvedValue({ jobId: "j1" }) };
    const preferences = {
      findByUserIdService: vi.fn().mockResolvedValue({
        emailEnabled: overrides.emailEnabled ?? true,
        pushEnabled: overrides.pushEnabled ?? true,
      }),
    };
    const deliveries = {
      tryRecord: vi.fn().mockResolvedValue(overrides.emailDedupeOk ?? true),
    };
    const notificationsService = {
      createFromTemplate: vi.fn().mockResolvedValue(undefined),
      resolveCopy: vi.fn().mockReturnValue({ title: "t", body: "b" }),
    };
    const registry = { get: vi.fn().mockResolvedValue(
      overrides.dailyEmailEnabled ?? CONFIG_CATALOG["notifications.daily_reminder.email_enabled"].default,
    ) };

    const service = new DailyReminderService(
      db,
      queue as never,
      coaching as never,
      preferences as never,
      deliveries as never,
      notificationsService as never,
      registry as never,
    );
    return { service, queue, deliveries, preferences, notificationsService, registry };
  }

  it("skips users with both channels disabled", async () => {
    const { service, queue } = makeService({ emailEnabled: false, pushEnabled: false });
    const result = await service.dispatchForToday();
    expect(result.skipped).toBe(1);
    expect(result.enqueued).toBe(0);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("enqueues email and push when eligible", async () => {
    const { service, queue } = makeService();
    const result = await service.dispatchForToday();
    expect(result.skipped).toBe(0);
    expect(result.enqueued).toBe(2);
    expect(queue.enqueue).toHaveBeenCalledWith(JobName.SEND_EMAIL, expect.objectContaining({
      to: "a@test.local",
      template: EmailTemplate.DAILY_REMINDER,
    }));
    expect(queue.enqueue).toHaveBeenCalledWith(JobName.SEND_PUSH, expect.objectContaining({
      userId: "u1",
    }));
  });

  it("does not enqueue email when dedupe hits", async () => {
    const { service, queue } = makeService({ emailDedupeOk: false, pushEnabled: false });
    await service.dispatchForToday();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("pauses reminder email while preserving the inbox and push", async () => {
    const { service, queue, deliveries, notificationsService } = makeService({ dailyEmailEnabled: false });
    expect(await service.dispatchForToday()).toEqual({ enqueued: 1, skipped: 0 });
    expect(notificationsService.createFromTemplate).toHaveBeenCalledOnce();
    expect(deliveries.tryRecord).not.toHaveBeenCalled();
    expect(queue.enqueue).toHaveBeenCalledOnce();
    expect(queue.enqueue).toHaveBeenCalledWith(JobName.SEND_PUSH, expect.objectContaining({ userId: "u1" }));
  });

  it("retains an inbox reminder when email is paused and the user declined push", async () => {
    const { service, queue, notificationsService } = makeService({ dailyEmailEnabled: false, pushEnabled: false });
    expect(await service.dispatchForToday()).toEqual({ enqueued: 0, skipped: 1 });
    expect(notificationsService.createFromTemplate).toHaveBeenCalledOnce();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("reads the reminder email setting once for the whole dispatch", async () => {
    const { service, registry } = makeService({ candidates: [], dailyEmailEnabled: false });
    await service.dispatchForToday();
    expect(registry.get).toHaveBeenCalledOnce();
    expect(registry.get).toHaveBeenCalledWith("notifications.daily_reminder.email_enabled");
  });
});
