import { describe, expect, it, vi } from "vitest";
import { ForumPublicService } from "./forum-public.service";

function setup() {
  const now = new Date("2026-10-01T00:00:00Z");
  const thread = { id: "question", title: "Question", body: "Question body", examType: "LGS", updatedAt: now, zoneUpdatedAt: now, createdAt: now };
  const answer = { id: "answer", body: "Answer body", isAccepted: false, updatedAt: now, createdAt: now };
  const posts = { listPublicAnswers: vi.fn(async () => [answer]) };
  const threads = { findPublicQuestion: vi.fn(async () => thread) };
  const config = { get: vi.fn(async () => true) };
  return { service: new ForumPublicService(threads as never, posts as never, config as never), thread, answer, posts, threads, config };
}

describe("public QA content revisions", () => {
  it("returns no author identity and a stable opaque snapshot", async () => {
    const { service } = setup();
    const first = await service.getQuestion("question");
    expect(first?.contentRevision).toMatch(/^[a-f0-9]{64}$/);
    expect(first?.contentRevision).toBe((await service.getQuestion("question"))?.contentRevision);
    expect(first).not.toHaveProperty("authorId");
    expect(first?.answers[0]).not.toHaveProperty("authorId");
    expect(first?.examType).toBe("LGS");
  });
  it.each(["question", "answer", "accepted", "zone"])("invalidates approval after a %s change", async (change) => {
    const { service, thread, answer } = setup();
    const original = (await service.getQuestion("question"))?.contentRevision;
    if (change === "question") { thread.title = "Edited"; thread.updatedAt = new Date(); }
    if (change === "answer") { answer.body = "Edited answer"; answer.updatedAt = new Date(); }
    if (change === "accepted") answer.isAccepted = true;
    if (change === "zone") thread.zoneUpdatedAt = new Date();
    expect((await service.getQuestion("question"))?.contentRevision).not.toBe(original);
    thread.title = "Question"; answer.body = "Answer body";
    if (change === "question" || change === "answer") {
      expect((await service.getQuestion("question"))?.contentRevision).not.toBe(original);
    }
  });
  it("invalidates on added/removed answers, independent of repository order", async () => {
    const { service, answer, posts } = setup();
    const original = (await service.getQuestion("question"))?.contentRevision;
    const other = { ...answer, id: "another" };
    posts.listPublicAnswers.mockResolvedValue([answer, other]);
    const added = (await service.getQuestion("question"))?.contentRevision;
    expect(added).not.toBe(original);
    posts.listPublicAnswers.mockResolvedValue([other, answer]);
    expect((await service.getQuestion("question"))?.contentRevision).toBe(added);
  });
  it("fails closed on disabled, hidden and newly unanswered questions", async () => {
    const { service, posts, threads, config } = setup();
    config.get.mockResolvedValueOnce(false);
    expect(await service.getQuestion("question")).toBeNull();
    threads.findPublicQuestion.mockResolvedValueOnce(null as never);
    expect(await service.getQuestion("question")).toBeNull();
    posts.listPublicAnswers.mockResolvedValueOnce([]);
    expect(await service.getQuestion("question")).toBeNull();
  });
});
