import { describe, expect, it } from "vitest";
import { CommunityBadgeId } from "@mentor/types";
import { deriveBadges, type BadgeSignals } from "./badges";

const NOW = new Date("2026-07-03T12:00:00Z");

const base: BadgeSignals = {
  currentStreak: 0,
  memberSince: new Date("2026-01-01T00:00:00Z"),
  totalPosts: 0,
  nightPosts: 0,
  reactionsReceived: 0,
  now: NOW,
};

describe("deriveBadges", () => {
  it("gives no badges for a blank slate", () => {
    expect(deriveBadges(base)).toEqual([]);
  });

  it("awards Marathon at a 7-day streak, not at 6", () => {
    expect(deriveBadges({ ...base, currentStreak: 6 })).not.toContain(CommunityBadgeId.MARATHON);
    expect(deriveBadges({ ...base, currentStreak: 7 })).toContain(CommunityBadgeId.MARATHON);
  });

  it("awards Night Owl only when night posts are the majority AND there are enough posts", () => {
    // majority night but too few posts → habit not established
    expect(deriveBadges({ ...base, totalPosts: 3, nightPosts: 3 })).not.toContain(
      CommunityBadgeId.NIGHT_OWL,
    );
    // enough posts, night <= half → no
    expect(deriveBadges({ ...base, totalPosts: 10, nightPosts: 5 })).not.toContain(
      CommunityBadgeId.NIGHT_OWL,
    );
    // enough posts, night majority → yes
    expect(deriveBadges({ ...base, totalPosts: 10, nightPosts: 6 })).toContain(
      CommunityBadgeId.NIGHT_OWL,
    );
  });

  it("awards Motivator at the reaction threshold", () => {
    expect(deriveBadges({ ...base, reactionsReceived: 9 })).not.toContain(
      CommunityBadgeId.MOTIVATOR,
    );
    expect(deriveBadges({ ...base, reactionsReceived: 10 })).toContain(CommunityBadgeId.MOTIVATOR);
  });

  it("awards Newcomer only within the first 14 days", () => {
    expect(
      deriveBadges({ ...base, memberSince: new Date("2026-07-01T00:00:00Z") }),
    ).toContain(CommunityBadgeId.NEWCOMER);
    expect(
      deriveBadges({ ...base, memberSince: new Date("2026-06-01T00:00:00Z") }),
    ).not.toContain(CommunityBadgeId.NEWCOMER);
  });
});
