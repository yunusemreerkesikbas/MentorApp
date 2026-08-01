import { describe, expect, it } from "vitest";
import {
  decodeForumFeedCursor,
  encodeForumFeedCursor,
  evaluateForumEditPolicy,
  mergeHubDiscussionIds,
  normalizeForumTagSlug,
  selectForumCoachIntent,
  uniqueForumTagIds,
} from "./forum-discovery.policy";

describe("forum discovery policy", () => {
  it.each([
    ["  Geometri & Matematik  ", "geometri-matematik"],
    ["Çalışma İpuçları", "calisma-ipuclari"],
    ["  MOTİVASYON ", "motivasyon"],
  ])("normalizes the curated tag slug %j", (input, expected) => {
    expect(normalizeForumTagSlug(input)).toBe(expected);
  });

  it("deduplicates selected tag ids while preserving order and rejects a fourth tag", () => {
    expect(uniqueForumTagIds(["tag-a", "tag-b", "tag-a", "tag-c"])).toEqual([
      "tag-a",
      "tag-b",
      "tag-c",
    ]);
    expect(() => uniqueForumTagIds(["tag-a", "tag-b", "tag-c", "tag-d"])).toThrow(
      "FORUM_TAG_LIMIT_EXCEEDED",
    );
  });

  it("allows only the owner to edit before the deadline when no locking interaction exists", () => {
    const now = new Date("2026-07-31T09:20:00.000Z");
    expect(
      evaluateForumEditPolicy({
        viewerId: "owner",
        authorId: "owner",
        createdAt: new Date("2026-07-31T09:00:00.000Z"),
        now,
        editWindowMinutes: 30,
        interactionCount: 0,
      }),
    ).toEqual({
      allowed: true,
      reason: null,
      deadline: new Date("2026-07-31T09:30:00.000Z"),
    });
  });

  it.each([
    ["another-user", "owner", "2026-07-31T09:20:00.000Z", 0, "FORBIDDEN"],
    ["owner", "owner", "2026-07-31T09:31:00.000Z", 0, "EXPIRED"],
    ["owner", "owner", "2026-07-31T09:20:00.000Z", 1, "LOCKED"],
  ] as const)(
    "rejects an edit when ownership, deadline, or interaction rules fail",
    (viewerId, authorId, now, interactionCount, reason) => {
      expect(
        evaluateForumEditPolicy({
          viewerId,
          authorId,
          createdAt: new Date("2026-07-31T09:00:00.000Z"),
          now: new Date(now),
          editWindowMinutes: 30,
          interactionCount,
        }),
      ).toMatchObject({ allowed: false, reason });
    },
  );

  it("round-trips a versioned feed cursor and rejects malformed or unsupported cursors", () => {
    const encoded = encodeForumFeedCursor({
      sort: "trending",
      score: 19,
      createdAt: "2026-07-31T09:00:00.000Z",
      lastActivityAt: "2026-07-31T09:30:00.000Z",
      id: "11111111-1111-4111-8111-111111111111",
    });

    expect(encoded).not.toContain("trending");
    expect(decodeForumFeedCursor(encoded)).toEqual({
      version: 1,
      sort: "trending",
      score: 19,
      createdAt: "2026-07-31T09:00:00.000Z",
      lastActivityAt: "2026-07-31T09:30:00.000Z",
      id: "11111111-1111-4111-8111-111111111111",
    });
    expect(decodeForumFeedCursor("not-a-cursor")).toBeNull();

    const unsupported = Buffer.from(
      JSON.stringify({
        version: 2,
        sort: "recent",
        score: 0,
        createdAt: "2026-07-31T09:00:00.000Z",
        lastActivityAt: "2026-07-31T09:30:00.000Z",
        id: "11111111-1111-4111-8111-111111111111",
      }),
    ).toString("base64url");
    expect(decodeForumFeedCursor(unsupported)).toBeNull();
  });

  it("keeps recent interactions first, removes duplicates, and fills the hub to four", () => {
    expect(
      mergeHubDiscussionIds(
        ["thread-b", "thread-a", "thread-b"],
        ["thread-a", "thread-c", "thread-d", "thread-e"],
      ),
    ).toEqual(["thread-b", "thread-a", "thread-c", "thread-d"]);
  });

  it("selects the highest-priority active coach intent deterministically", () => {
    expect(
      selectForumCoachIntent([
        { slug: "motivasyon", coachIntent: "NEXT_STEP", isActive: true },
        { slug: "sinav-stratejisi", coachIntent: "STRATEGY", isActive: true },
        { slug: "calisma-ipuclari", coachIntent: "STUDY_METHOD", isActive: true },
        { slug: "planlama", coachIntent: "PLAN", isActive: true },
      ]),
    ).toEqual({ slug: "planlama", intent: "PLAN" });
  });

  it("ignores inactive and unconfigured tags", () => {
    expect(
      selectForumCoachIntent([
        { slug: "planlama", coachIntent: "PLAN", isActive: false },
        { slug: "kaynak-onerisi", coachIntent: null, isActive: true },
      ]),
    ).toBeNull();
  });
});
