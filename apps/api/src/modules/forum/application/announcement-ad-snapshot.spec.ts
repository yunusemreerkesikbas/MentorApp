import { describe, expect, it } from "vitest";
import { buildAnnouncementAdSnapshot } from "./announcement-ad-snapshot";

function setup() {
  const zone = { id: "z", title: "Announcements", slug: "announcements", type: "ANNOUNCEMENT", visibility: "PUBLIC", isArchived: false, examType: "YKS" };
  const thread = { id: "t", zoneId: "z", title: null, body: "Our weekly announcement", authorId: "u", authorName: "Editor", authorUsername: "editor", authorAvatarUrl: null,
    attachments: [], tags: [{ slug: "weekly", name: "Weekly" }], editedAt: null, createdAt: "2026-01-01", poll: null, coachBridge: null, isPinned: false, commenterNames: [] };
  const comment = { id: "c", threadId: "t", parentPostId: null, body: "Visible comment", authorId: "v", authorName: "Reader", authorUsername: "reader", authorAvatarUrl: null,
    attachments: [], editedAt: null, createdAt: "2026-01-02", replyCount: 0 };
  const publicRooms = [{ ...zone, updatedAt: new Date("2026-01-01") }];
  const detail = { thread, comments: [comment] };
  return { zone, thread, comment, detail, publicRooms, build: () => buildAnnouncementAdSnapshot(detail as never, zone as never, [zone] as never, publicRooms as never) };
}
describe("reviewed announcement publisher snapshot", () => {
  it("covers visible publisher content without private viewer actions", () => {
    const s = setup(); const before = s.build()!;
    expect(before.contentRevision).toMatch(/^[a-f0-9]{64}$/);
    Object.assign(s.thread, { myBookmarked: true, myReactions: ["heart"], reactionCounts: { heart: 5 } });
    expect(s.build()?.contentRevision).toBe(before.contentRevision);
    expect(before.thread).not.toHaveProperty("myBookmarked");
  });
  it.each(["body", "comment", "author", "avatar", "image", "tags", "edit-time", "reply-count", "sidebar"])("invalidates approval after %s changes", (change) => {
    const s = setup(); const before = s.build()?.contentRevision;
    if (change === "body") s.thread.body = "Changed";
    if (change === "comment") s.comment.body = "Changed comment";
    if (change === "author") s.comment.authorName = "Changed author";
    if (change === "avatar") Object.assign(s.thread, { authorAvatarUrl: "/new.webp" });
    if (change === "image") Object.assign(s.comment, { attachments: [{ id: "image", kind: "image", url: "/new.webp" }] });
    if (change === "tags") s.thread.tags[0]!.name = "New label";
    if (change === "edit-time") Object.assign(s.comment, { editedAt: "2026-01-03" });
    if (change === "reply-count") s.comment.replyCount = 1;
    if (change === "sidebar") s.zone.title = "Renamed room";
    expect(s.build()?.contentRevision).not.toBe(before);
  });
  it.each(["CHAT", "QA", "PRIVATE", "archived", "empty", "unknown-exam", "missing-zone", "poll", "coach", "inline-image", "comment-inline-image", "file"])("rejects %s context", (reason) => {
    const s = setup();
    if (reason === "CHAT" || reason === "QA") s.zone.type = reason;
    if (reason === "PRIVATE") s.zone.visibility = reason;
    if (reason === "archived") s.zone.isArchived = true;
    if (reason === "empty") s.thread.body = " ";
    if (reason === "unknown-exam") s.zone.examType = "UNKNOWN";
    if (reason === "missing-zone") s.publicRooms.length = 0;
    if (reason === "poll") Object.assign(s.thread, { poll: {} });
    if (reason === "coach") Object.assign(s.thread, { coachBridge: {} });
    if (reason === "inline-image") s.thread.body = "![external](https://example.test/image)";
    if (reason === "comment-inline-image") s.comment.body = "![external](https://example.test/image)";
    if (reason === "file") Object.assign(s.comment, { attachments: [{ kind: "file", url: "/notes.pdf" }] });
    expect(s.build()).toBeNull();
  });
});
