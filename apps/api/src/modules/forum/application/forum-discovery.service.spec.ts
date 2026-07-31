import { HttpStatus } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ForumDiscoveryService } from "./forum-discovery.service";

const repo = {
  interactionCount: vi.fn(),
  addHelpfulVote: vi.fn(),
  removeHelpfulVote: vi.fn(),
  activeTagCount: vi.fn(),
  replaceThreadTags: vi.fn(),
  updateThread: vi.fn(),
};
const threads = { findById: vi.fn() };
const posts = { findById: vi.fn() };
const zones = { findById: vi.fn(), findMembershipsByZone: vi.fn() };
const attachments = {};
const bookmarks = {};
const forum = {};
const threadService = {};
const users = {};
const follow = {};
const config = { get: vi.fn() };
const storage = { getPublicUrl: vi.fn((key: string) => `https://cdn.test/${key}`) };

function service() {
  return new ForumDiscoveryService(
    repo as never,
    threads as never,
    posts as never,
    zones as never,
    attachments as never,
    bookmarks as never,
    forum as never,
    threadService as never,
    users as never,
    follow as never,
    config as never,
    storage as never,
  );
}

describe("ForumDiscoveryService mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    config.get.mockImplementation((key: string) => {
      if (key === "forum.enabled") return Promise.resolve(true);
      if (key === "forum.discovery.edit_window_minutes") return Promise.resolve(30);
      return Promise.resolve(0);
    });
  });

  it("keeps the forum feature flag's existing 404 behavior", async () => {
    config.get.mockResolvedValueOnce(false);

    await expect(service().listTags("viewer", "tr")).rejects.toMatchObject({
      code: ErrorCode.FORUM_DISABLED,
      httpStatus: HttpStatus.NOT_FOUND,
    });
  });

  it("rejects a helpful vote on the viewer's own QA question", async () => {
    threads.findById.mockResolvedValue({
      id: "thread",
      zoneId: "zone",
      authorId: "viewer",
    });
    zones.findById.mockResolvedValue({ id: "zone", type: "QA" });

    await expect(service().helpfulVote("viewer", "THREAD", "thread", true)).rejects.toMatchObject({
      code: ErrorCode.FORUM_HELPFUL_VOTE_SELF,
      httpStatus: HttpStatus.BAD_REQUEST,
    });
    expect(repo.addHelpfulVote).not.toHaveBeenCalled();
  });

  it("returns 409 and leaves the thread unchanged after a locking interaction", async () => {
    threads.findById.mockResolvedValue({
      id: "thread",
      zoneId: "zone",
      authorId: "viewer",
      createdAt: new Date(Date.now() - 5 * 60_000),
    });
    repo.interactionCount.mockResolvedValue(1);

    await expect(
      service().updateThread("viewer", "thread", { body: "Güncellenen içerik" }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof DomainError &&
        error.code === ErrorCode.FORUM_EDIT_LOCKED &&
        error.httpStatus === HttpStatus.CONFLICT,
    );
    expect(repo.updateThread).not.toHaveBeenCalled();
  });

  it("updates an untouched owner thread and replaces only active, deduplicated tags", async () => {
    threads.findById.mockResolvedValue({
      id: "thread",
      zoneId: "zone",
      authorId: "viewer",
      createdAt: new Date(),
    });
    repo.interactionCount.mockResolvedValue(0);
    repo.activeTagCount.mockResolvedValue(2);

    await service().updateThread("viewer", "thread", {
      body: "Güncellenen içerik",
      tagIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        "11111111-1111-4111-8111-111111111111",
      ],
    });

    expect(repo.updateThread).toHaveBeenCalledWith("thread", {
      body: "Güncellenen içerik",
    });
    expect(repo.replaceThreadTags).toHaveBeenCalledWith("thread", [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
  });
});
