import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WeeklyRecapOfferDto, WeeklyReviewDto } from "@mentor/types";
import {
  composeWeeklyRecapStory,
  recapAccessView,
  weeklyRecapFinalActionsVisible,
} from "../dist/index.js";

function review(
  status: WeeklyReviewDto["recap"]["status"],
  overrides: Partial<WeeklyReviewDto> = {},
): WeeklyReviewDto {
  const base: WeeklyReviewDto = {
    period: { startDate: "2026-07-13", endDate: "2026-07-19", timeZone: "Europe/Istanbul" },
    status: status === "READY" ? "READY" : "INSUFFICIENT",
    recap: {
      status,
      activeDays: 0,
      weeklyTitle: null,
      nextStorySignal: null,
      nextStorySignals: [],
      closingMessage: "Yanındayım.",
    },
    evidence: {
      mockExamCount: 0,
      completedSessionCount: 0,
      qualifyingSessionCount: 0,
      completedPlanTaskCount: 0,
    },
    rhythm: {
      completedSessionCount: 0,
      focusMinutes: 0,
      activeDays: 0,
      longestSessionMinutes: 0,
      longestActiveRun: 0,
      focusTimeBand: null,
      peakFocusDay: null,
      days: [],
      subjectBreakdown: [],
      moodCheckinCount: 0,
      energySignal: null,
      message: "Ritim",
    },
    plan: { completedTaskCount: 0, subjectBreakdown: [], message: "Plan" },
    highlights: [],
    performance: null,
    focus: null,
    suggestedTask: null,
  };
  return { ...base, ...overrides };
}

describe("weekly recap story", () => {
  it("composes the eight READY slides with timing and the title's character", () => {
    const ready = review("READY");
    ready.recap.weeklyTitle = { id: "FOCUS_DIVER", label: "Odak Dalgıcı", message: "Derine daldın." };
    const slides = composeWeeklyRecapStory(ready);
    assert.deepEqual(
      slides.map((slide) => slide.kind),
      ["welcome", "week_map", "focus", "weekly_run", "weekly_best", "performance", "weekly_title", "final"],
    );
    assert.deepEqual(
      slides.map((slide) => slide.durationMs),
      [10000, 7000, 7000, 7000, 7000, 7000, 8000, 7000],
    );
    assert.deepEqual(slides[6]?.character, { key: "nebulaDiver", headlineAtMs: 4000, supportAtMs: 6000 });
    assert.ok(slides.filter((slide) => slide.kind !== "weekly_title").every((slide) => slide.character === null));
    assert.deepEqual(slides[0]?.audio, { key: "popTrack03", startSeconds: 0 });
  });

  it("returns no slides for EMPTY", () => {
    assert.deepEqual(composeWeeklyRecapStory(review("EMPTY")), []);
  });

  it("keeps the PARTIAL ordering", () => {
    const partial = review("PARTIAL");
    partial.evidence.qualifyingSessionCount = 2;
    partial.rhythm.longestActiveRun = 3;
    assert.deepEqual(
      composeWeeklyRecapStory(partial).map((slide) => slide.kind),
      ["welcome", "week_map", "focus", "weekly_run", "spark", "partial_unlocks", "partial_final"],
    );
  });

  it("shows the final actions at the support beat or whenever paused", () => {
    const final = { kind: "final" as const, durationMs: 7000 };
    const at = (playing: boolean, elapsedMs: number) => ({ index: 7, elapsedMs, playing, completed: false });
    assert.equal(weeklyRecapFinalActionsVisible(final, at(true, 3000)), false);
    assert.equal(weeklyRecapFinalActionsVisible(final, at(true, 3200)), true);
    assert.equal(weeklyRecapFinalActionsVisible(final, at(false, 0)), true);
    assert.equal(weeklyRecapFinalActionsVisible({ kind: "focus", durationMs: 7000 }, at(false, 0)), false);
  });
});

describe("weekly recap access view", () => {
  it("never leads with Premium when purchases are off", () => {
    const offer: WeeklyRecapOfferDto = {
      enabled: true,
      examId: "exam",
      weekStart: "2026-07-13",
      endDate: "2026-07-19",
      ready: true,
      premium: false,
      mode: "COIN",
      canOpen: false,
      premiumAvailable: true,
      reportId: null,
      cost: 300,
      coinConfirmed: 120,
      coinLimit: 2,
      coinRemaining: 2,
      windowDays: 30,
      nextAvailableAt: null,
      teaser: { activeDays: 4, focusMinutes: 180, topSubject: null },
      reason: "INSUFFICIENT_COIN",
    };
    assert.deepEqual(recapAccessView(offer, false), {
      kind: "choice",
      lead: null,
      coin: "short",
      premium: false,
      missing: 180,
    });
  });
});
