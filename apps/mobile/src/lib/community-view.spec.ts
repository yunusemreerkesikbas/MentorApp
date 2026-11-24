import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ZoneView } from "@mentor/types";
import {
  deriveQuestionStatus,
  formatLeagueResetParts,
  groupZonesByMembership,
  nextLeagueReset,
} from "./community-view.ts";

function makeZone(id: string, myStatus: ZoneView["myStatus"]): ZoneView {
  return {
    id,
    type: "CHAT",
    title: `Oda ${id}`,
    slug: `oda-${id}`,
    description: null,
    visibility: "PUBLIC",
    joinPolicy: "OPEN",
    examType: "KPSS",
    isArchived: false,
    memberCount: 3,
    threadCount: 2,
    myStatus,
    myRole: myStatus === "ACTIVE" ? "MEMBER" : null,
    canModerate: false,
    createdAt: "2026-11-01T10:00:00.000Z",
  };
}

describe("community-view helpers", () => {
  it("computes Istanbul league reset boundaries across windows", () => {
    // 2026-11-21 19:00 UTC == 2026-11-21 22:00 Istanbul (Saturday)
    const now = new Date("2026-11-21T19:00:00.000Z");

    assert.equal(nextLeagueReset("all_time", now), null);
    assert.equal(formatLeagueResetParts("all_time", now), null);

    // Next Istanbul midnight: 2026-11-22 00:00+03:00 == 2026-11-21T21:00:00.000Z (2 hours away)
    assert.equal(nextLeagueReset("today", now)?.toISOString(), "2026-11-21T21:00:00.000Z");
    assert.deepEqual(formatLeagueResetParts("today", now), { days: 0, hours: 2, minutes: 0 });

    // Next Monday Istanbul 00:00: 2026-11-23 00:00+03:00 == 2026-11-22T21:00:00.000Z (1d 2h away)
    assert.equal(nextLeagueReset("weekly", now)?.toISOString(), "2026-11-22T21:00:00.000Z");
    assert.deepEqual(formatLeagueResetParts("weekly", now), { days: 1, hours: 2, minutes: 0 });
  });

  it("derives QA question status prioritizing accepted answers", () => {
    assert.deepEqual(deriveQuestionStatus({ commentCount: 0, acceptedPostId: null }), {
      kind: "waiting",
    });
    assert.deepEqual(deriveQuestionStatus({ commentCount: 3, acceptedPostId: null }), {
      kind: "answers",
      answers: 3,
    });
    assert.deepEqual(deriveQuestionStatus({ commentCount: 2, acceptedPostId: "post-1" }), {
      kind: "solved",
      answers: 2,
    });
  });

  it("groups zones into active memberships and other discoverable zones", () => {
    const grouped = groupZonesByMembership([
      makeZone("1", "ACTIVE"),
      makeZone("2", null),
      makeZone("3", "PENDING"),
      makeZone("4", "ACTIVE"),
    ]);
    assert.deepEqual(
      grouped.mine.map((z) => z.id),
      ["1", "4"],
    );
    assert.deepEqual(
      grouped.others.map((z) => z.id),
      ["2", "3"],
    );
  });
});
