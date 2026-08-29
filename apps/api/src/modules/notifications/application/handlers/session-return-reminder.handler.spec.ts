import { afterEach, describe, expect, it, vi } from "vitest";
import { DeliveryTemplate, JobName } from "../../domain/notifications.constants";
import { NotificationCopyKey } from "../../domain/notification-copy";
import { SessionReturnReminderHandler } from "./session-return-reminder.handler";

describe("SessionReturnReminderHandler", () => {
  afterEach(() => vi.restoreAllMocks());

  const USER = "11111111-1111-1111-1111-111111111111";
  const db = {
    transaction: async <T>(cb: (tx: unknown) => Promise<T>) =>
      cb({ execute: async () => undefined }),
  } as never;

  function fakeNotifications() {
    return {
      resolveCopy: vi.fn((key: string, args: Record<string, unknown> = {}) => ({
        title: "Yarınki adımın duruyor",
        body: args.subject ? String(args.subject) : "generic",
      })),
      createFromTemplate: vi.fn().mockResolvedValue(undefined),
    };
  }

  it("creates in-app and enqueues push when push enabled", async () => {
    const notifications = fakeNotifications();
    const enqueue = vi.fn().mockResolvedValue({ jobId: "j1" });
    const findByUserIdService = vi.fn().mockResolvedValue({ pushEnabled: true });
    const handler = new SessionReturnReminderHandler(
      db,
      { enqueue } as never,
      { findByUserIdService } as never,
      notifications as never,
    );

    await handler.handle({
      userId: USER,
      linkUrl: "/study-session?subject=Matematik",
      subject: "Matematik",
      targetDate: "2026-07-13",
    });

    expect(notifications.createFromTemplate).toHaveBeenCalledWith(
      USER,
      "COACH",
      NotificationCopyKey.SESSION_RETURN_WITH_SUBJECT,
      "/study-session?subject=Matematik",
      expect.objectContaining({ args: { subject: "Matematik" } }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      JobName.SEND_PUSH,
      expect.objectContaining({
        userId: USER,
        url: "/study-session?subject=Matematik",
        template: DeliveryTemplate.SESSION_RETURN,
        dedupeKey: "session-return-push:2026-07-13",
        title: "Yarınki adımın duruyor",
        body: "Matematik",
      }),
    );
  });

  it("skips push when push disabled", async () => {
    const notifications = fakeNotifications();
    const enqueue = vi.fn();
    const handler = new SessionReturnReminderHandler(
      db,
      { enqueue } as never,
      { findByUserIdService: vi.fn().mockResolvedValue({ pushEnabled: false }) } as never,
      notifications as never,
    );

    await handler.handle({
      userId: USER,
      linkUrl: "/study-session",
      subject: null,
      targetDate: "2026-07-13",
    });

    expect(notifications.createFromTemplate).toHaveBeenCalledOnce();
    expect(enqueue).not.toHaveBeenCalled();
  });
});
