import { BadRequestException, NotFoundException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAnnouncementSchema } from "@mentor/validation";
import { JobName } from "../domain/notifications.constants";
import { AnnouncementService } from "./announcement.service";

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACTOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const db = {
  transaction: async <T>(cb: (tx: unknown) => Promise<T>) => cb({ execute: async () => undefined }),
} as never;

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    title: "Yeni özellik",
    body: "Çalışma odaları yayında.",
    linkUrl: "/panel",
    audience: { kind: "ALL" },
    status: "DRAFT",
    scheduledAt: null,
    sentAt: null,
    recipientCount: 0,
    createdAt: new Date("2026-08-28T09:00:00Z"),
    ...overrides,
  };
}

function build(repo: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}) {
  const announcements = {
    create: vi.fn().mockResolvedValue(row()),
    findById: vi.fn().mockResolvedValue(row()),
    list: vi.fn().mockResolvedValue([row()]),
    markSending: vi.fn().mockResolvedValue(row({ status: "SENDING" })),
    deleteDraft: vi.fn().mockResolvedValue(true),
    ...repo,
  };
  const enqueue = vi.fn().mockResolvedValue({ jobId: "j1" });
  const service = new AnnouncementService(db, { enqueue } as never, announcements as never);
  return { service, announcements, enqueue };
}

describe("AnnouncementService", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates a DRAFT owned by the acting admin", async () => {
    const t = build();
    const dto = await t.service.create(
      { title: "Yeni özellik", body: "Çalışma odaları yayında.", audience: { kind: "ALL" } },
      ACTOR,
    );

    expect(t.announcements.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ createdBy: ACTOR, audience: { kind: "ALL" } }),
    );
    expect(dto.status).toBe("DRAFT");
    expect(dto.recipientCount).toBe(0);
  });

  it("enqueues an immediate dispatch job when no schedule is given", async () => {
    const t = build();
    const dto = await t.service.send(ID, {});

    expect(t.enqueue).toHaveBeenCalledWith(
      JobName.DISPATCH_ANNOUNCEMENT,
      { announcementId: ID, afterUserId: null },
      undefined,
    );
    expect(dto.status).toBe("SENDING");
  });

  it("passes scheduledAt through as the job's runAt", async () => {
    const t = build();
    const when = "2026-09-01T06:00:00.000Z";
    t.announcements.markSending = vi
      .fn()
      .mockResolvedValue(row({ status: "SENDING", scheduledAt: new Date(when) }));

    await t.service.send(ID, { scheduledAt: when }, new Date("2026-08-28T09:00:00Z"));

    expect(t.enqueue).toHaveBeenCalledWith(JobName.DISPATCH_ANNOUNCEMENT, expect.anything(), {
      runAt: new Date(when),
    });
  });

  it("rejects a schedule in the past", async () => {
    const t = build();
    await expect(
      t.service.send(ID, { scheduledAt: "2026-08-01T06:00:00.000Z" }, new Date("2026-08-28T09:00:00Z")),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(t.enqueue).not.toHaveBeenCalled();
  });

  it("refuses to send a non-DRAFT (the DRAFT→SENDING guard lost the race)", async () => {
    const t = build({ markSending: vi.fn().mockResolvedValue(null) });
    await expect(t.service.send(ID, {})).rejects.toBeInstanceOf(BadRequestException);
    expect(t.enqueue).not.toHaveBeenCalled();
  });

  it("404s when sending an announcement that does not exist", async () => {
    const t = build({ findById: vi.fn().mockResolvedValue(null) });
    await expect(t.service.send(ID, {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it("refuses to delete an already sent announcement", async () => {
    const t = build({
      findById: vi.fn().mockResolvedValue(row({ status: "SENT" })),
      deleteDraft: vi.fn().mockResolvedValue(false),
    });
    await expect(t.service.deleteDraft(ID)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("createAnnouncementSchema linkUrl", () => {
  const base = { title: "Başlık", body: "Metin", audience: { kind: "ALL" as const } };

  it.each(["https://evil.com", "//evil.com", "http://x.test/a", "panel", "javascript:alert(1)"])(
    "rejects %s",
    (linkUrl) => {
      expect(createAnnouncementSchema.safeParse({ ...base, linkUrl }).success).toBe(false);
    },
  );

  it.each(["/panel", "/seans?subject=Matematik"])("accepts %s", (linkUrl) => {
    expect(createAnnouncementSchema.safeParse({ ...base, linkUrl }).success).toBe(true);
  });
});
