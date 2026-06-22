import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpStatus } from "@nestjs/common";
import { UserRole, ZoneMemberStatus, ZoneRole, ZoneType } from "@mentor/types";
import { ForumQaService } from "./forum-qa.service";

const question = (over: Record<string, unknown> = {}) => ({
  id: "q1",
  zoneId: "z1",
  authorId: "asker",
  title: "Soru?",
  body: "gövde",
  status: "OPEN",
  acceptedPostId: null,
  isPinned: false,
  deletedAt: null,
  deletedBy: null,
  createdAt: new Date("2026-06-22T10:00:00Z"),
  updatedAt: new Date("2026-06-22T10:00:00Z"),
  ...over,
});

const answer = (over: Record<string, unknown> = {}) => ({
  id: "a1",
  threadId: "q1",
  authorId: "answerer",
  body: "cevap",
  isAccepted: false,
  deletedAt: null,
  deletedBy: null,
  createdAt: new Date("2026-06-22T11:00:00Z"),
  updatedAt: new Date("2026-06-22T11:00:00Z"),
  ...over,
});

const makeThreadRepo = () => ({
  findById: vi.fn().mockResolvedValue(question()),
  setQaAccepted: vi.fn().mockResolvedValue(undefined),
  searchQuestions: vi.fn().mockResolvedValue({ items: [], total: 0 }),
});
const makePostRepo = () => ({
  createAnswer: vi.fn().mockResolvedValue(answer()),
  listByThread: vi.fn().mockResolvedValue([]),
  findById: vi.fn().mockResolvedValue(answer()),
  setAccepted: vi.fn().mockResolvedValue(undefined),
  softDelete: vi.fn().mockResolvedValue(undefined),
});
const makeZoneRepo = (memberStatus: string | null = ZoneMemberStatus.ACTIVE) => ({
  findById: vi.fn().mockResolvedValue({ id: "z1", type: ZoneType.QA }),
  findMembership: vi
    .fn()
    .mockResolvedValue(memberStatus ? { role: ZoneRole.MEMBER, status: memberStatus } : null),
});
const config = { get: vi.fn().mockResolvedValue(true) };
const events = { emit: vi.fn(), emitAsync: vi.fn().mockResolvedValue([]) };
const actor = (id: string, roles: string[] = [UserRole.STUDENT]) => ({ id, roles });

describe("ForumQaService", () => {
  let threads: ReturnType<typeof makeThreadRepo>;
  let posts: ReturnType<typeof makePostRepo>;

  beforeEach(() => {
    threads = makeThreadRepo();
    posts = makePostRepo();
    events.emit.mockClear();
    events.emitAsync.mockClear();
  });

  const svc = (zoneRepo: ReturnType<typeof makeZoneRepo>) =>
    new ForumQaService(threads as never, posts as never, zoneRepo as never, config as never, events as never);

  it("rejects a non-member answering", async () => {
    await expect(
      svc(makeZoneRepo(null)).answer(actor("u1"), "q1", { body: "cevap" }),
    ).rejects.toMatchObject({ httpStatus: HttpStatus.FORBIDDEN });
    expect(posts.createAnswer).not.toHaveBeenCalled();
  });

  it("an ACTIVE member can answer", async () => {
    const view = await svc(makeZoneRepo()).answer(actor("u1"), "q1", { body: "cevap" });
    expect(view.id).toBe("a1");
    expect(posts.createAnswer).toHaveBeenCalledWith({ threadId: "q1", authorId: "u1", body: "cevap" });
  });

  it("only the asker can accept; others are forbidden", async () => {
    await expect(
      svc(makeZoneRepo()).accept(actor("notAsker"), "q1", "a1"),
    ).rejects.toMatchObject({ httpStatus: HttpStatus.FORBIDDEN });
  });

  it("asker accepts → marks post + thread and emits ANSWER_ACCEPTED", async () => {
    await svc(makeZoneRepo()).accept(actor("asker"), "q1", "a1");
    expect(posts.setAccepted).toHaveBeenCalledWith("a1", true);
    expect(threads.setQaAccepted).toHaveBeenCalledWith("q1", "a1");
    expect(events.emitAsync).toHaveBeenCalledWith(
      "forum.answer.accepted",
      expect.objectContaining({ threadId: "q1", postId: "a1", answerAuthorId: "answerer", askerId: "asker" }),
    );
  });

  it("a second accept is rejected (one-shot, 409)", async () => {
    threads.findById.mockResolvedValue(question({ status: "ANSWERED", acceptedPostId: "a1" }));
    await expect(
      svc(makeZoneRepo()).accept(actor("asker"), "q1", "a2"),
    ).rejects.toMatchObject({ httpStatus: HttpStatus.CONFLICT });
    expect(events.emitAsync).not.toHaveBeenCalled();
  });

  it("rejects accepting an answer that belongs to another question", async () => {
    posts.findById.mockResolvedValue(answer({ threadId: "OTHER" }));
    await expect(
      svc(makeZoneRepo()).accept(actor("asker"), "q1", "a1"),
    ).rejects.toMatchObject({ httpStatus: HttpStatus.NOT_FOUND });
  });
});
