import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CoachPlanAdaptationBriefDto, CoachPlanAdaptationChangeDto } from "@mentor/types";
import {
  flattenPlanAdaptationChanges,
  formatKnownBrief,
  isMinuteEntry,
  parsePlanAdaptationQuery,
  planWindowDays,
  seedBriefSubjects,
  selectedPlanAdaptationChanges,
  STAGE_MAX_NOTES,
  stageNoteIndex,
  stageNotes,
  stagePileDepth,
  summarizePendingWeek,
} from "../dist/index.js";

describe("plan brief helpers", () => {
  it("counts pending tasks and keeps the first spelling of each subject", () => {
    assert.deepEqual(
      summarizePendingWeek({
        "2026-11-16": [
          { status: "PENDING", subject: "Matematik" },
          { status: "DONE", subject: "Fizik" },
          { status: "PENDING", subject: " matematik " },
          { status: "PENDING", subject: null },
        ],
        "2026-11-17": [{ status: "PENDING", subject: "İngilizce" }],
      }),
      { pendingCount: 4, subjects: ["Matematik", "İngilizce"] },
    );
  });

  it("seeds subjects in taxonomy order, matching case-insensitively", () => {
    assert.deepEqual(seedBriefSubjects(["Türkçe", "Matematik", "Fizik"], ["fizik", "matematik"]), [
      "Matematik",
      "Fizik",
    ]);
  });

  it("joins the known facts and has no line without any", () => {
    assert.equal(formatKnownBrief({ exam: "YKS", goal: null, pending: "3 görev" }), "YKS · 3 görev");
    assert.equal(formatKnownBrief({ exam: null, goal: null, pending: null }), null);
  });

  it("takes any whole minute count between 10 and 600", () => {
    assert.equal([10, 45, 600].every(isMinuteEntry), true);
    assert.equal([null, 9, 601, 12.5].some(isMinuteEntry), false);
  });

  it("lists the next seven days as ISO weekdays, starting today", () => {
    const days = planWindowDays(new Date(2026, 10, 14));
    assert.equal(days.length, 7);
    assert.deepEqual(
      days.map((day) => day.weekday),
      [6, 7, 1, 2, 3, 4, 5],
    );
  });
});

describe("plan stage scene", () => {
  const brief = (count: number): CoachPlanAdaptationBriefDto => ({
    groundingLine: null,
    evidence: Array.from({ length: count }, (_, index) => ({
      type: "STREAK",
      summary: `note ${index}`,
      observedAt: "2026-11-14",
    })) as CoachPlanAdaptationBriefDto["evidence"],
    suggestion: { days: null, weekdays: null, minutesPerDay: null, focusSubjects: [] },
  });

  it("keeps the first six notes, none without a brief", () => {
    assert.deepEqual(stageNotes(null), []);
    assert.equal(stageNotes(brief(8)).length, STAGE_MAX_NOTES);
  });

  it("turns to the next note every line and wraps around", () => {
    assert.equal(stageNoteIndex(7_200, 3), 2);
    assert.equal(stageNoteIndex(10_800, 3), 0);
    assert.equal(stageNoteIndex(9_999, 0), 0);
  });

  it("piles at most two sheets and never more than the other notes", () => {
    assert.equal(stagePileDepth(50_000, 6), 2);
    assert.equal(stagePileDepth(36_000, 2), 1);
    assert.equal(stagePileDepth(50_000, 1), 0);
  });
});

describe("plan preview rows", () => {
  const changes: CoachPlanAdaptationChangeDto[] = [
    { kind: "MOVE", taskId: "t1", title: "A", subject: null, fromDate: "2026-11-16", toDate: "2026-11-18" },
    { kind: "ADD", title: "B", subject: "Fizik", taskDate: "2026-11-17" } as CoachPlanAdaptationChangeDto,
  ];

  it("keys each change and returns only the checked ones", () => {
    const rows = flattenPlanAdaptationChanges(changes);
    assert.deepEqual(
      rows.map((row) => [row.key, row.date]),
      [
        ["MOVE:t1", "2026-11-18"],
        ["ADD:2026-11-17:1", "2026-11-17"],
      ],
    );
    assert.deepEqual(selectedPlanAdaptationChanges(rows, new Set(["ADD:2026-11-17:1"])), [changes[1]]);
  });

  it("reads only the one-shot query shapes", () => {
    assert.deepEqual(parsePlanAdaptationQuery({ coach: "adapt", source: "mood", sessionId: null }), {
      source: "MOOD",
    });
    assert.equal(parsePlanAdaptationQuery({ coach: null, source: "mood", sessionId: null }), null);
    assert.equal(parsePlanAdaptationQuery({ coach: "adapt", source: "other", sessionId: null }), null);
  });
});
