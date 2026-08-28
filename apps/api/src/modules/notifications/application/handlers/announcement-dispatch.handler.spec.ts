import { afterEach, describe, expect, it, vi } from "vitest";
import { JobName } from "../../domain/notifications.constants";
import {
  ANNOUNCEMENT_BATCH_SIZE,
  AnnouncementDispatchHandler,
} from "./announcement-dispatch.handler";

const ANNOUNCEMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function userId(n: number): string {
  return `${String(n).padStart(8, "0")}-1111-4111-8111-111111111111`;
}

/** `withServiceContext` only needs a transaction callback that can run `tx.execute`. */
const db = {
  transaction: async <T>(cb: (tx: unknown) => Promise<T>) => cb({ execute: async () => undefined }),
} as never;

function build(overrides: {
  announcement?: Record<string, unknown> | null;
  recipients?: Array<{ id: string }>;
  created?: Array<{ userId: string }>;
}) {
  const announcement =
    overrides.announcement === undefined
      ? {
          id: ANNOUNCEMENT_ID,
          title: "Yeni özellik",
          body: "Çalışma odaları yayında.",
          linkUrl: "/panel",
          audience: { kind: "ALL" },
          status: "SENDING",
        }
      : overrides.announcement;
  const recipients = overrides.recipients ?? [];
  const created = overrides.created ?? recipients.map((r) => ({ userId: r.id }));

  const announcements = {
    findById: vi.fn().mockResolvedValue(announcement),
    addRecipients: vi.fn().mockResolvedValue(undefined),
    markSent: vi.fn().mockResolvedValue(undefined),
  };
  const userNotifs = { createMany: vi.fn().mockResolvedValue(created) };
  const users = { listAnnouncementRecipients: vi.fn().mockResolvedValue(recipients) };
  const notifications = { pushRealtimeEvent: vi.fn() };
  const enqueue = vi.fn().mockResolvedValue({ jobId: "j1" });

  const handler = new AnnouncementDispatchHandler(
    db,
    { enqueue } as never,
    announcements as never,
    userNotifs as never,
    users as never,
    notifications as never,
  );
  return { handler, announcements, userNotifs, users, notifications, enqueue };
}

describe("AnnouncementDispatchHandler", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fans out a partial batch, counts recipients and marks the announcement sent", async () => {
    const recipients = [{ id: userId(1) }, { id: userId(2) }];
    const t = build({ recipients });

    await t.handler.handle({ announcementId: ANNOUNCEMENT_ID, afterUserId: null });

    expect(t.users.listAnnouncementRecipients).toHaveBeenCalledWith(
      null,
      null,
      ANNOUNCEMENT_BATCH_SIZE,
    );
    expect(t.userNotifs.createMany).toHaveBeenCalledWith(
      expect.anything(),
      recipients.map((r) => ({
        userId: r.id,
        category: "SYSTEM",
        title: "Yeni özellik",
        body: "Çalışma odaları yayında.",
        linkUrl: "/panel",
        dedupeKey: `announcement:${ANNOUNCEMENT_ID}`,
      })),
    );
    expect(t.notifications.pushRealtimeEvent).toHaveBeenCalledTimes(2);
    expect(t.announcements.addRecipients).toHaveBeenCalledWith(
      expect.anything(),
      ANNOUNCEMENT_ID,
      2,
    );
    expect(t.announcements.markSent).toHaveBeenCalled();
    expect(t.enqueue).not.toHaveBeenCalled();
  });

  it("re-enqueues itself with a cursor when the batch is full, without marking sent", async () => {
    const recipients = Array.from({ length: ANNOUNCEMENT_BATCH_SIZE }, (_, i) => ({
      id: userId(i + 1),
    }));
    const t = build({ recipients });

    await t.handler.handle({ announcementId: ANNOUNCEMENT_ID, afterUserId: null });

    expect(t.announcements.markSent).not.toHaveBeenCalled();
    expect(t.enqueue).toHaveBeenCalledWith(JobName.DISPATCH_ANNOUNCEMENT, {
      announcementId: ANNOUNCEMENT_ID,
      afterUserId: recipients[recipients.length - 1]!.id,
    });
  });

  it("passes the exam-type filter through to the recipient query", async () => {
    const t = build({
      announcement: {
        id: ANNOUNCEMENT_ID,
        title: "KPSS duyurusu",
        body: "Takvim güncellendi.",
        linkUrl: null,
        audience: { kind: "EXAM_TYPE", examType: "KPSS" },
        status: "SENDING",
      },
      recipients: [{ id: userId(1) }],
    });

    await t.handler.handle({ announcementId: ANNOUNCEMENT_ID, afterUserId: null });

    expect(t.users.listAnnouncementRecipients).toHaveBeenCalledWith(
      "KPSS",
      null,
      ANNOUNCEMENT_BATCH_SIZE,
    );
  });

  it("is idempotent: a replayed batch inserts nothing and pings nobody", async () => {
    // The (user_id, dedupe_key) partial unique index makes the insert a no-op on replay,
    // so `createMany` returns zero rows even though the recipients still resolve.
    const t = build({ recipients: [{ id: userId(1) }, { id: userId(2) }], created: [] });

    await t.handler.handle({ announcementId: ANNOUNCEMENT_ID, afterUserId: null });

    expect(t.notifications.pushRealtimeEvent).not.toHaveBeenCalled();
    expect(t.announcements.addRecipients).toHaveBeenCalledWith(
      expect.anything(),
      ANNOUNCEMENT_ID,
      0,
    );
    expect(t.announcements.markSent).toHaveBeenCalled();
  });

  it("drops the job when the announcement is already SENT", async () => {
    const t = build({
      announcement: { id: ANNOUNCEMENT_ID, status: "SENT", audience: { kind: "ALL" } },
    });

    await t.handler.handle({ announcementId: ANNOUNCEMENT_ID, afterUserId: null });

    expect(t.users.listAnnouncementRecipients).not.toHaveBeenCalled();
    expect(t.userNotifs.createMany).not.toHaveBeenCalled();
  });

  it("drops the job when the announcement no longer exists", async () => {
    const t = build({ announcement: null });

    await t.handler.handle({ announcementId: ANNOUNCEMENT_ID, afterUserId: null });

    expect(t.users.listAnnouncementRecipients).not.toHaveBeenCalled();
  });
});
