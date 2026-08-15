import { HttpStatus } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForumPollService } from "./forum-poll.service";

const aggregate = (over: Record<string, unknown> = {}) => ({
  id: "poll-1",
  threadId: "thread-1",
  endsAt: new Date("2026-08-16T12:00:00.000Z"),
  myOptionId: null,
  options: [
    { id: "option-1", text: "Sabah", position: 0, voteCount: 2 },
    { id: "option-2", text: "Akşam", position: 1, voteCount: 1 },
  ],
  ...over,
});

describe("ForumPollService", () => {
  const repo = {
    listByThreadIds: vi.fn(),
    vote: vi.fn(),
    findById: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it("hides option results before the viewer votes", async () => {
    repo.listByThreadIds.mockResolvedValue([aggregate()]);
    const views = await new ForumPollService(repo as never).viewsForThreads(
      ["thread-1"],
      "viewer-1",
      new Date("2026-08-15T12:00:00.000Z"),
    );

    expect(views.get("thread-1")).toEqual({
      id: "poll-1",
      endsAt: "2026-08-16T12:00:00.000Z",
      status: "ACTIVE",
      canVote: true,
      resultsVisible: false,
      myOptionId: null,
      totalVoteCount: 3,
      options: [
        { id: "option-1", text: "Sabah", position: 0, voteCount: null, percentage: null },
        { id: "option-2", text: "Akşam", position: 1, voteCount: null, percentage: null },
      ],
    });
  });

  it("reveals stable percentages after the viewer votes", async () => {
    repo.listByThreadIds.mockResolvedValue([aggregate({ myOptionId: "option-2" })]);
    const views = await new ForumPollService(repo as never).viewsForThreads(
      ["thread-1"],
      "viewer-1",
      new Date("2026-08-15T12:00:00.000Z"),
    );

    expect(views.get("thread-1")?.options).toEqual([
      { id: "option-1", text: "Sabah", position: 0, voteCount: 2, percentage: 67 },
      { id: "option-2", text: "Akşam", position: 1, voteCount: 1, percentage: 33 },
    ]);
    expect(views.get("thread-1")?.canVote).toBe(false);
  });

  it("reveals results after the poll closes even without a viewer vote", async () => {
    repo.listByThreadIds.mockResolvedValue([aggregate()]);
    const views = await new ForumPollService(repo as never).viewsForThreads(
      ["thread-1"],
      "viewer-1",
      new Date("2026-08-17T12:00:00.000Z"),
    );

    expect(views.get("thread-1")).toMatchObject({
      status: "CLOSED",
      canVote: false,
      resultsVisible: true,
    });
  });

  it.each([
    ["POLL_NOT_FOUND", "FORUM_POLL_NOT_FOUND", HttpStatus.NOT_FOUND],
    ["OPTION_INVALID", "FORUM_POLL_OPTION_INVALID", HttpStatus.BAD_REQUEST],
    ["CLOSED", "FORUM_POLL_CLOSED", HttpStatus.CONFLICT],
    ["ALREADY_VOTED", "FORUM_POLL_ALREADY_VOTED", HttpStatus.CONFLICT],
  ] as const)("maps repository vote result %s to a safe domain error", async (result, code, status) => {
    repo.vote.mockResolvedValue(result);
    await expect(
      new ForumPollService(repo as never).vote("viewer-1", "poll-1", "option-1"),
    ).rejects.toMatchObject({ code, httpStatus: status });
  });

  it("returns the refreshed viewer-specific poll after a successful vote", async () => {
    repo.vote.mockResolvedValue("CREATED");
    repo.findById.mockResolvedValue(aggregate({ myOptionId: "option-1" }));
    const result = await new ForumPollService(repo as never).vote(
      "viewer-1",
      "poll-1",
      "option-1",
    );

    expect(result.myOptionId).toBe("option-1");
    expect(result.resultsVisible).toBe(true);
  });
});
