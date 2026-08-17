import { HttpStatus } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ForumDiscoveryService } from "./forum-discovery.service";

const repo = {
  listDiscoveryThreads: vi.fn(),
  tagsByThread: vi.fn(),
  myHelpfulTargets: vi.fn(),
  interactionCount: vi.fn(),
  addHelpfulVote: vi.fn(),
  removeHelpfulVote: vi.fn(),
  activeTagCount: vi.fn(),
  replaceThreadTags: vi.fn(),
  updateThread: vi.fn(),
  getFeaturedThread: vi.fn(),
  setFeaturedThread: vi.fn(),
  trendingTags: vi.fn(),
  searchThreadSummaries: vi.fn(),
  searchZones: vi.fn(),
  searchTags: vi.fn(),
  createTagSuggestion: vi.fn(),
  listTagSuggestions: vi.fn(),
  resolveTagSuggestion: vi.fn(),
};
const threads = {
  findById: vi.fn(),
  findByIdIncludingDeleted: vi.fn(),
  reactionCountsByThread: vi.fn(),
  myReactionsByThread: vi.fn(),
};
const posts = { findById: vi.fn() };
const zones = { findById: vi.fn(), findMembershipsByZone: vi.fn() };
const attachments = { listForTargets: vi.fn() };
const bookmarks = { myBookmarkedTargets: vi.fn() };
const forum = {};
const threadService = {};
const users = { getDiscoveryProfile: vi.fn(), searchPublicUsers: vi.fn() };
const follow = { getFolloweeIds: vi.fn() };
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
    repo.tagsByThread.mockResolvedValue(new Map());
    repo.myHelpfulTargets.mockResolvedValue(new Set());
    threads.reactionCountsByThread.mockResolvedValue(new Map());
    threads.myReactionsByThread.mockResolvedValue(new Map());
    attachments.listForTargets.mockResolvedValue(new Map());
    bookmarks.myBookmarkedTargets.mockResolvedValue(new Set());
    zones.findMembershipsByZone.mockResolvedValue(new Map());
  });

  it("keeps the forum feature flag's existing 404 behavior", async () => {
    config.get.mockResolvedValueOnce(false);

    await expect(service().listTags("viewer", "tr")).rejects.toMatchObject({
      code: ErrorCode.FORUM_DISABLED,
      httpStatus: HttpStatus.NOT_FOUND,
    });
  });

  it("normalizes a member tag suggestion and returns the pending view", async () => {
    repo.createTagSuggestion.mockResolvedValue({
      id: "suggestion",
      requestedName: "Çalışma Rutini",
      normalizedSlug: "calisma-rutini",
      status: "PENDING",
      resolvedTagId: null,
      createdAt: new Date("2026-08-16T10:00:00.000Z"),
      reviewedAt: null,
    });

    await expect(
      service().createTagSuggestion("viewer", { name: "Çalışma Rutini" }),
    ).resolves.toMatchObject({ normalizedSlug: "calisma-rutini", status: "PENDING" });
    expect(repo.createTagSuggestion).toHaveBeenCalledWith(
      "viewer",
      "Çalışma Rutini",
      "calisma-rutini",
    );
  });

  it("returns conflict when a canonical tag or pending suggestion already exists", async () => {
    repo.createTagSuggestion.mockResolvedValue(null);

    await expect(
      service().createTagSuggestion("viewer", { name: "Planlama" }),
    ).rejects.toMatchObject({
      code: ErrorCode.FORUM_TAG_SUGGESTION_EXISTS,
      httpStatus: HttpStatus.CONFLICT,
    });
  });

  it("returns the approved suggestion produced by the transactional repository review", async () => {
    repo.resolveTagSuggestion.mockResolvedValue({
      kind: "OK",
      row: {
        id: "suggestion",
        requestedName: "Çalışma Rutini",
        normalizedSlug: "calisma-rutini",
        status: "APPROVED",
        resolvedTagId: "tag",
        createdAt: new Date("2026-08-16T10:00:00.000Z"),
        reviewedAt: new Date("2026-08-16T11:00:00.000Z"),
      },
    });

    await expect(
      service().reviewAdminTagSuggestion("editor", "suggestion", {
        action: "APPROVE",
        nameTr: "Çalışma Rutini",
        nameEn: "Study Routine",
        examType: null,
      }),
    ).resolves.toMatchObject({ status: "APPROVED", resolvedTagId: "tag" });
  });

  it("returns conflict when an editor reviews an already resolved suggestion", async () => {
    repo.resolveTagSuggestion.mockResolvedValue({ kind: "RESOLVED" });

    await expect(
      service().reviewAdminTagSuggestion("editor", "suggestion", { action: "REJECT" }),
    ).rejects.toMatchObject({
      code: ErrorCode.FORUM_TAG_SUGGESTION_RESOLVED,
      httpStatus: HttpStatus.CONFLICT,
    });
  });

  it("maps the feed content filter to question-only or non-QA repository filters", async () => {
    users.getDiscoveryProfile.mockResolvedValue({ examType: "KPSS" });
    repo.listDiscoveryThreads.mockResolvedValue([]);

    await service().getFeed(
      { id: "viewer", roles: ["STUDENT"] },
      { scope: "relevant", sort: "recent", contentType: "questions", limit: 20 },
      "tr",
    );
    expect(repo.listDiscoveryThreads).toHaveBeenLastCalledWith(
      expect.objectContaining({
        zoneType: "QA",
        zoneTypes: undefined,
        weights: expect.objectContaining({ unanswered: 0 }),
      }),
    );

    await service().getFeed(
      { id: "viewer", roles: ["STUDENT"] },
      { scope: "relevant", sort: "recent", contentType: "posts", limit: 20 },
      "tr",
    );
    expect(repo.listDiscoveryThreads).toHaveBeenLastCalledWith(
      expect.objectContaining({ zoneType: undefined, zoneTypes: ["CHAT", "ANNOUNCEMENT"] }),
    );
  });

  it("returns exam-aware trends with the configured activity window", async () => {
    users.getDiscoveryProfile.mockResolvedValue({ examType: "KPSS" });
    repo.trendingTags.mockResolvedValue([
      {
        tag: {
          id: "11111111-1111-4111-8111-111111111111",
          slug: "paragraf",
          nameTr: "Paragraf",
          nameEn: "Paragraph",
          examType: "KPSS",
          coachIntent: null,
          isActive: true,
          createdBy: null,
          updatedBy: null,
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
          updatedAt: new Date("2026-08-01T00:00:00.000Z"),
        },
        threadCount: 8,
        latestActivityAt: new Date("2026-08-09T08:00:00.000Z"),
      },
    ]);
    config.get.mockImplementation((key: string) => {
      if (key === "forum.enabled") return Promise.resolve(true);
      if (key === "forum.discovery.trending_window_hours") return Promise.resolve(72);
      return Promise.resolve(0);
    });

    await expect(
      service().getTrends({ id: "viewer", roles: ["STUDENT"] }, { scope: "exam", limit: 5 }, "tr"),
    ).resolves.toMatchObject({
      scope: "exam",
      examType: "KPSS",
      windowHours: 72,
      items: [{ slug: "paragraf", name: "Paragraf", threadCount: 8 }],
    });
    expect(repo.trendingTags).toHaveBeenCalledWith("tr", "KPSS", 5, "exam", 72);
  });

  it("returns backward-compatible search groups plus public zones and QA questions", async () => {
    const chatThread = {
      id: "11111111-1111-4111-8111-111111111111",
      zoneSlug: "matematik-geometri",
      zoneTitle: "Matematik & Geometri",
      zoneType: "CHAT",
      title: "Problem rutini",
      body: "Her sabah kısa bir problem rutini uyguluyorum.",
      commentCount: 3,
      lastActivityAt: new Date("2026-08-09T08:00:00.000Z"),
    };
    const question = {
      ...chatThread,
      id: "22222222-2222-4222-8222-222222222222",
      zoneSlug: "soru-cevap",
      zoneTitle: "Soru & Cevap",
      zoneType: "QA",
      title: "Problem rutinini nasıl kuruyorsunuz?",
    };
    repo.searchThreadSummaries.mockResolvedValueOnce([chatThread]).mockResolvedValueOnce([question]);
    repo.searchZones.mockResolvedValue([
      {
        id: "33333333-3333-4333-8333-333333333333",
        slug: "matematik-geometri",
        title: "Matematik & Geometri",
        type: "CHAT",
        description: "Birlikte çalışılan oda",
      },
    ]);
    repo.searchTags.mockResolvedValue([]);
    users.searchPublicUsers.mockResolvedValue([]);

    await expect(service().search("viewer", "problem", "tr")).resolves.toMatchObject({
      threads: [{ id: chatThread.id, zoneType: "CHAT" }],
      questions: [{ id: question.id, zoneType: "QA" }],
      zones: [{ slug: "matematik-geometri", type: "CHAT" }],
      tags: [],
      people: [],
    });
    expect(repo.searchThreadSummaries).toHaveBeenNthCalledWith(1, "problem", 5);
    expect(repo.searchThreadSummaries).toHaveBeenNthCalledWith(2, "problem", 5, "QA");
    expect(repo.searchZones).toHaveBeenCalledWith("problem", 5);
  });

  it("returns the selected thread summary with the admin featured state", async () => {
    repo.getFeaturedThread.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      zoneSlug: "genel-sohbet",
      zoneTitle: "Genel Sohbet",
      zoneType: "CHAT",
      title: "Deneme haftasında motivasyonu nasıl koruyorsun?",
      body: "Birbirimize iyi gelen küçük yöntemleri paylaşalım.",
      commentCount: 7,
      lastActivityAt: new Date("2026-07-31T12:00:00.000Z"),
      featuredUntil: new Date("2026-08-07T12:00:00.000Z"),
      featuredBy: "22222222-2222-4222-8222-222222222222",
    });

    await expect(service().getAdminFeatured()).resolves.toEqual({
      threadId: "11111111-1111-4111-8111-111111111111",
      featuredUntil: "2026-08-07T12:00:00.000Z",
      featuredBy: "22222222-2222-4222-8222-222222222222",
      thread: {
        id: "11111111-1111-4111-8111-111111111111",
        zoneSlug: "genel-sohbet",
        zoneTitle: "Genel Sohbet",
        zoneType: "CHAT",
        title: "Deneme haftasında motivasyonu nasıl koruyorsun?",
        bodyExcerpt: "Birbirimize iyi gelen küçük yöntemleri paylaşalım.",
        commentCount: 7,
        lastActivityAt: "2026-07-31T12:00:00.000Z",
      },
    });
  });

  it("returns the selected thread summary after an editor features it", async () => {
    const threadId = "11111111-1111-4111-8111-111111111111";
    const actorId = "22222222-2222-4222-8222-222222222222";
    threads.findByIdIncludingDeleted.mockResolvedValue({
      id: threadId,
      deletedAt: null,
    });
    repo.getFeaturedThread.mockResolvedValue({
      id: threadId,
      zoneSlug: "soru-cevap",
      zoneTitle: "Soru Cevap",
      zoneType: "QA",
      title: "Paragraf rutinini nasıl kurdun?",
      body: "Her gün sürdürebildiğin yöntemi paylaş.",
      commentCount: 4,
      lastActivityAt: new Date("2026-07-31T13:00:00.000Z"),
      featuredUntil: new Date("2099-08-07T12:00:00.000Z"),
      featuredBy: actorId,
    });

    await expect(
      service().setAdminFeatured(actorId, {
        threadId,
        featuredUntil: "2099-08-07T12:00:00.000Z",
      }),
    ).resolves.toMatchObject({
      threadId,
      featuredBy: actorId,
      thread: {
        id: threadId,
        zoneTitle: "Soru Cevap",
        zoneType: "QA",
        title: "Paragraf rutinini nasıl kurdun?",
      },
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
