import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readySummaryRows, shouldAskPush } from "./onboarding-summary.ts";

describe("ready summary", () => {
  it("student: exam, goal, field, reminder, countdown (web order)", () => {
    const rows = readySummaryRows({ role: "student", examType: "YKS", examVariant: null, dailyGoalMinutes: 30, careerGroup: "SAGLIK", reminder: true });
    assert.deepEqual(rows.map((r) => r.kind), ["exam", "goal", "field", "reminder", "countdown"]);
    assert.deepEqual(rows[1], { kind: "goal", minutes: 30 });
  });
  it("leaves out what was skipped", () => {
    const rows = readySummaryRows({ role: "student", examType: null, examVariant: null, dailyGoalMinutes: null, careerGroup: null, reminder: false });
    assert.deepEqual(rows.map((r) => r.kind), ["countdown"]);
  });
  it("coach never gets a field row or the countdown", () => {
    const rows = readySummaryRows({ role: "coach", examType: "KPSS", examVariant: "LISANS", dailyGoalMinutes: null, careerGroup: "SAGLIK", reminder: true });
    assert.deepEqual(rows.map((r) => r.kind), ["exam", "reminder"]);
    assert.deepEqual(rows[0], { kind: "exam", examType: "KPSS", examVariant: "LISANS" });
  });
});

describe("push ask", () => {
  it("asks only when the phone has not decided yet", () => {
    assert.equal(shouldAskPush("undetermined"), true);
    for (const s of ["granted", "denied", "unsupported"] as const) assert.equal(shouldAskPush(s), false);
  });
});
