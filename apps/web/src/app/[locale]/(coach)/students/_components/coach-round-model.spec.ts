import { describe, expect, it } from "vitest";
import {
  MentorshipRiskFlag,
  type MentorshipRiskFlagId,
  type MentorshipRosterRowDto,
} from "@mentor/types";
import { buildCoachRound, groupRoster } from "./coach-round-model";

const TODAY = "2026-09-24";

function row(
  id: string,
  over: {
    flags?: MentorshipRiskFlagId[];
    needsAttention?: boolean;
    attendedAt?: string | null;
    studiedToday?: number;
    status?: "ACTIVE" | "ENDED";
  } = {},
): MentorshipRosterRowDto {
  const flags = over.flags ?? [];
  const strip = Array<number>(14).fill(0);
  strip[13] = over.studiedToday ?? 0;
  return {
    linkId: `link-${id}`,
    studentId: id,
    studentDisplayName: `Öğrenci ${id}`,
    studentUsername: null,
    avatarUrl: null,
    status: over.status ?? "ACTIVE",
    acceptedAt: "2026-09-01T00:00:00.000Z",
    endedAt: null,
    metrics:
      over.status === "ENDED"
        ? null
        : {
            lastActiveDate: "2026-09-20",
            currentStreak: 0,
            focusMinutes7d: 0,
            dailyFocusMinutes14d: strip,
            sessions7d: 0,
            activeDays7d: 0,
            planCompletionRate7d: null,
            latestMockNet: null,
            latestMockAt: null,
            moodLevel7dAvg: null,
          },
    riskFlags: flags,
    attendedAt: over.attendedAt ?? null,
    needsAttention: over.needsAttention ?? flags.length > 0,
  };
}

const waiting = (id: string, flag: MentorshipRiskFlagId = MentorshipRiskFlag.INACTIVE) =>
  row(id, { flags: [flag] });
/** Marked this morning (Istanbul), and the mark still covers the student's flags. */
const seenToday = (id: string) =>
  row(id, {
    flags: [MentorshipRiskFlag.PLAN_SLIPPING],
    needsAttention: false,
    attendedAt: `${TODAY}T06:00:00.000Z`,
  });
const calm = (id: string) => row(id);

const states = (round: ReturnType<typeof buildCoachRound>) =>
  round.nodes.map((node) => `${node.row.studentId}:${node.state}`);

describe("buildCoachRound", () => {
  it("walks today's handled students first, then the waiting ones in the server's order", () => {
    const round = buildCoachRound(
      [waiting("zeynep"), waiting("ali", MentorshipRiskFlag.NET_DROP), seenToday("mert"), calm("burak")],
      TODAY,
    );
    expect(round.kind).toBe("waiting");
    expect(states(round)).toEqual(["mert:done", "zeynep:current", "ali:upcoming"]);
    expect(round.waiting).toBe(2);
    expect(round.next?.studentId).toBe("zeynep");
    expect(round.order).toEqual(["zeynep", "ali"]);
  });

  it("names each waiting node by its worst flag", () => {
    const round = buildCoachRound(
      [row("ece", { flags: [MentorshipRiskFlag.PLAN_SLIPPING, MentorshipRiskFlag.LOW_MOOD] })],
      TODAY,
    );
    expect(round.nodes[0]?.flag).toBe(MentorshipRiskFlag.LOW_MOOD);
  });

  it("folds the waiting students past five into a count", () => {
    const round = buildCoachRound(
      ["a", "b", "c", "d", "e", "f", "g"].map((id) => waiting(id)),
      TODAY,
    );
    expect(states(round)).toEqual(["a:current", "b:upcoming", "c:upcoming", "d:upcoming", "e:upcoming"]);
    expect(round.hiddenAfter).toBe(2);
    expect(round.order).toHaveLength(7);
  });

  it("keeps one handled student in view before the next one and folds the rest", () => {
    const round = buildCoachRound(
      [seenToday("m1"), seenToday("m2"), seenToday("m3"), ...["a", "b", "c", "d"].map((id) => waiting(id))],
      TODAY,
    );
    expect(round.hiddenBefore).toBe(2);
    expect(states(round)).toEqual(["m3:done", "a:current", "b:upcoming", "c:upcoming", "d:upcoming"]);
  });

  it("completes when everyone who waited today has been seen", () => {
    const round = buildCoachRound([seenToday("mert"), seenToday("zeynep"), calm("burak")], TODAY);
    expect(round.kind).toBe("complete");
    expect(states(round)).toEqual(["mert:done", "zeynep:done"]);
    expect(round.next).toBeNull();
  });

  it("has nothing to walk when nobody waits and nobody was seen today", () => {
    const round = buildCoachRound([calm("burak"), calm("ayse")], TODAY);
    expect(round.kind).toBe("calm");
    expect(round.nodes).toEqual([]);
  });

  it("is an invitation when the coach has no students yet", () => {
    expect(buildCoachRound([], TODAY).kind).toBe("empty");
  });

  it("puts a stale mark back in the queue", () => {
    // Marked eight days ago; the server says the student is waiting again.
    const stale = row("zeynep", {
      flags: [MentorshipRiskFlag.INACTIVE],
      needsAttention: true,
      attendedAt: "2026-09-16T08:00:00.000Z",
    });
    expect(states(buildCoachRound([stale], TODAY))).toEqual(["zeynep:current"]);
  });

  it("leaves yesterday's marks out of today's round", () => {
    const yesterday = row("mert", {
      flags: [MentorshipRiskFlag.PLAN_SLIPPING],
      needsAttention: false,
      attendedAt: "2026-09-23T10:00:00.000Z",
    });
    expect(buildCoachRound([yesterday], TODAY).kind).toBe("calm");
  });

  it("dates a mark by the Istanbul day it was made on", () => {
    // 22:30 UTC on the 23rd is 01:30 on the 24th in Istanbul.
    const lateNight = row("mert", {
      flags: [MentorshipRiskFlag.PLAN_SLIPPING],
      needsAttention: false,
      attendedAt: "2026-09-23T22:30:00.000Z",
    });
    expect(states(buildCoachRound([lateNight], TODAY))).toEqual(["mert:done"]);
  });

  it("counts the students who studied today", () => {
    const round = buildCoachRound(
      [row("a", { studiedToday: 25 }), row("b", { studiedToday: 0 }), waiting("c")],
      TODAY,
    );
    expect(round.studiedToday).toBe(1);
  });
});

describe("groupRoster", () => {
  it("splits the list into waiting, seen today and on track", () => {
    const groups = groupRoster(
      [waiting("zeynep"), calm("burak"), seenToday("mert"), waiting("ali")],
      TODAY,
    );
    expect(groups.waiting.map((r) => r.studentId)).toEqual(["zeynep", "ali"]);
    expect(groups.seenToday.map((r) => r.studentId)).toEqual(["mert"]);
    expect(groups.onTrack.map((r) => r.studentId)).toEqual(["burak"]);
  });

  it("files a student marked on an earlier day under on track", () => {
    const earlier = row("mert", {
      flags: [MentorshipRiskFlag.PLAN_SLIPPING],
      needsAttention: false,
      attendedAt: "2026-09-22T10:00:00.000Z",
    });
    expect(groupRoster([earlier], TODAY).onTrack).toHaveLength(1);
  });
});
