import { describe, expect, it, vi } from "vitest";
import { DomainError } from "../../../common/errors/domain-error";
import { ForumAnnouncementPageService } from "./forum-announcement-page.service";

const actor = { id: "reader", roles: ["STUDENT"] };
function setup() {
  const detail = { thread: { id: "t", zoneId: "z", body: "Announcement", attachments: [], tags: [], commenterNames: [] }, comments: [] };
  const zone = { id: "z", title: "Announcements", slug: "announcements", type: "ANNOUNCEMENT", visibility: "PUBLIC", isArchived: false, examType: "YKS" };
  const threads = { getThreadDetail: vi.fn(async () => detail) };
  const forum = { listZones: vi.fn(async () => ({ items: [zone], total: 1 })) };
  const zones = { listPublicReviewZones: vi.fn(async () => [{ ...zone, updatedAt: new Date() }]) };
  const config = { get: vi.fn(async () => true) };
  const service = new ForumAnnouncementPageService(threads as never, forum as never, zones as never, config as never);
  return { service, threads, forum, zones, config, detail, zone };
}
describe("announcement detail page proof", () => {
  it("preserves the old path while disabled but permits administrative preview", async () => {
    const s = setup(); s.config.get.mockResolvedValue(false);
    expect(await s.service.getDetail(actor, "t")).toBe(s.detail);
    expect(s.forum.listZones).not.toHaveBeenCalled();
    expect((await s.service.getReviewSnapshot(actor, "t"))?.contentRevision).toMatch(/^[a-f0-9]{64}$/);
  });
  it("returns exact room and sidebar context only for eligible public announcements", async () => {
    const s = setup(); const page = await s.service.getDetail(actor, "t");
    expect(page.adContext?.zone).toBe(s.zone); expect(page.adContext?.sidebarRooms).toEqual([s.zone]);
    s.zone.type = "CHAT";
    expect((await s.service.getDetail(actor, "t")).adContext).toBeUndefined();
  });
  it("keeps normal reading available after failed or incomplete context reads", async () => {
    const s = setup(); s.forum.listZones.mockRejectedValueOnce(new Error("unavailable"));
    expect(await s.service.getDetail(actor, "t")).toBe(s.detail);
    s.forum.listZones.mockResolvedValue({ items: [], total: 101 });
    expect(await s.service.getDetail(actor, "t")).toBe(s.detail);
  });
  it("supports revocation after content disappears while surfacing real preview errors", async () => {
    const s = setup(); s.threads.getThreadDetail.mockRejectedValueOnce(new DomainError("NOT_FOUND", 404));
    expect(await s.service.getReviewSnapshot(actor, "t")).toBeNull();
    s.threads.getThreadDetail.mockRejectedValueOnce(new Error("database down"));
    await expect(s.service.getReviewSnapshot(actor, "t")).rejects.toThrow("database down");
  });
});
