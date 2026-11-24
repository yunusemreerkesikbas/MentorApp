import { describe, expect, it, vi } from "vitest";
import { NotificationCopyKey } from "../domain/notification-copy";
import { JobName } from "../domain/notifications.constants";
import { NotificationsService } from "./notifications.service";

const STUDENT = "33333333-3333-4333-8333-333333333333";
const PUSH = { template: "mentorship.plan", dedupeKey: `mentorship-plan:${STUDENT}:2026-09-14` };

function setup(
  options: { created?: boolean; preferences?: { pushEnabled: boolean } | undefined } = {},
) {
  const tx = { execute: vi.fn() };
  const db = {
    transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  };
  const preferences = {
    findByUserIdService: vi
      .fn()
      .mockResolvedValue("preferences" in options ? options.preferences : { pushEnabled: true }),
    getOrCreate: vi.fn().mockResolvedValue({ emailEnabled: true, pushEnabled: true, campaignsEnabled: true }),
  };
  const userNotifs = {
    create: vi.fn().mockResolvedValue(options.created === false ? null : { id: "n-1" }),
  };
  const copy = {
    resolve: vi.fn(() => ({
      title: "Koçundan bir görev",
      body: "Koç Mert planına bir görev ekledi.",
    })),
  };
  const queue = { enqueue: vi.fn().mockResolvedValue({ jobId: "job-1" }) };
  const registry = { get: vi.fn().mockResolvedValue(5) };
  const mobileTokens = {
    upsertWithinLimit: vi.fn().mockResolvedValue({ id: "mp-1" }),
    deleteByToken: vi.fn().mockResolvedValue(undefined),
  };
  const service = new NotificationsService(
    db as never,
    {} as never,
    preferences as never,
    userNotifs as never,
    {} as never,
    copy as never,
    { pushRealtimeEvent: vi.fn() } as never,
    registry as never,
    {} as never,
    queue as never,
    mobileTokens as never,
  );
  return { service, preferences, queue, mobileTokens, tx };
}

describe("NotificationsService push channel", () => {
  it("queues one push with the inbox copy and link when a new row lands for a push-enabled user", async () => {
    const { service, queue } = setup();

    await expect(
      service.createFromTemplate(
        STUDENT,
        "MENTORSHIP",
        NotificationCopyKey.MENTORSHIP_ASSIGNED_SINGULAR,
        "/plan?date=2026-09-15",
        { args: { name: "Koç Mert" }, push: PUSH },
      ),
    ).resolves.toBe(true);

    expect(queue.enqueue).toHaveBeenCalledOnce();
    expect(queue.enqueue).toHaveBeenCalledWith(JobName.SEND_PUSH, {
      userId: STUDENT,
      title: "Koçundan bir görev",
      body: "Koç Mert planına bir görev ekledi.",
      url: "/plan?date=2026-09-15",
      ...PUSH,
    });
  });

  it("pushes nothing when the inbox dedupe swallowed the row", async () => {
    const { service, queue, preferences } = setup({ created: false });

    await expect(
      service.createFromTemplate(
        STUDENT,
        "MENTORSHIP",
        NotificationCopyKey.MENTORSHIP_ASSIGNED_SINGULAR,
        "/plan",
        { push: PUSH },
      ),
    ).resolves.toBe(false);

    expect(preferences.findByUserIdService).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it.each([
    ["switched push off", { pushEnabled: false }],
    ["never subscribed (no preferences row)", undefined],
  ])("pushes nothing to a user who %s", async (_label, preferences) => {
    const { service, queue } = setup({ preferences });

    await service.createFromTemplate(
      STUDENT,
      "MENTORSHIP",
      NotificationCopyKey.MENTORSHIP_ASSIGNED_SINGULAR,
      "/plan",
      { push: PUSH },
    );

    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("keeps callers without the push option on the in-app path, with no preference read", async () => {
    const { service, queue, preferences } = setup();

    await service.createFromTemplate(
      STUDENT,
      "MENTORSHIP",
      NotificationCopyKey.MENTORSHIP_COACH_NOTE,
      "/my-coach",
    );

    expect(preferences.findByUserIdService).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("registers and unregisters mobile push tokens with preference initialization", async () => {
    const { service, mobileTokens, preferences, tx } = setup();
    const token = "ExponentPushToken[abcdefghijklmnopqrstuv]";

    await service.registerMobilePushToken(STUDENT, { token, platform: "android" });
    expect(mobileTokens.upsertWithinLimit).toHaveBeenCalledWith(
      tx,
      STUDENT,
      { token, platform: "android" },
      5,
    );
    expect(preferences.getOrCreate).toHaveBeenCalledWith(tx, STUDENT);

    await service.unregisterMobilePushToken(STUDENT, token);
    expect(mobileTokens.deleteByToken).toHaveBeenCalledWith(tx, STUDENT, token);
  });
});
