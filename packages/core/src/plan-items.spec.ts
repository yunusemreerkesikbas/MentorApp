import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlanEventDto } from "@mentor/types";
import {
  canonicalHm,
  groupPlanEventsByDate,
  isCoachAssigned,
  minuteChoices,
  pad,
  planTaskLockedFocus,
} from "../dist/index.js";

describe("plan clock helpers", () => {
  it("pads a clock time and rejects a clock that does not exist", () => {
    assert.equal(canonicalHm("9:05"), "09:05");
    assert.equal(canonicalHm("10:30"), "10:30");
    assert.equal(canonicalHm("24:00"), null);
    assert.equal(canonicalHm("10:60"), null);
    assert.equal(canonicalHm("ab"), null);
    assert.equal(canonicalHm(""), null);
  });

  it("lists five-minute ticks and keeps an off-grid minute in order", () => {
    assert.deepEqual(minuteChoices(null), [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    const withSeven = minuteChoices(7);
    assert.equal(withSeven.length, 13);
    assert.deepEqual(withSeven.slice(1, 4), [5, 7, 10]);
    assert.equal(minuteChoices(30).includes(7), false);
    assert.equal(pad(7), "07");
  });
});

describe("isCoachAssigned", () => {
  it("is true only for a human coach's assignment", () => {
    assert.equal(isCoachAssigned({ origin: { type: "MENTORSHIP", linkId: "l1" } }), true);
    assert.equal(isCoachAssigned({ origin: { type: "AI_COACH", coachMessageId: "m1" } }), false);
    assert.equal(isCoachAssigned({ origin: null }), false);
  });
});

describe("groupPlanEventsByDate", () => {
  const event = (id: string, eventDate = "2026-09-28") => ({ id, eventDate }) as PlanEventDto;

  it("keys events by date and keeps their order inside a day", () => {
    const grouped = groupPlanEventsByDate([event("a"), event("b", "2026-09-29"), event("c")]);
    assert.deepEqual(Object.keys(grouped).sort(), ["2026-09-28", "2026-09-29"]);
    assert.deepEqual(
      grouped["2026-09-28"]!.map((item) => item.id),
      ["a", "c"],
    );
  });
});

describe("planTaskLockedFocus", () => {
  it("locks the subject and topic of an analysis task", () => {
    assert.deepEqual(
      planTaskLockedFocus({
        origin: {
          type: "ANALYSIS",
          examId: "e1",
          baselineMockExamId: "m1",
          subjectRef: "tyt-mat",
          topicRef: "fonksiyon",
          source: "LOWEST_AVERAGE",
          evidenceCount: 3,
        },
        subject: "TYT Matematik",
        topic: "Fonksiyonlar",
      }),
      { subject: "TYT Matematik", topic: "Fonksiyonlar" },
    );
  });

  it("locks a weekly-report task even without a subject (the caller names the routine)", () => {
    assert.deepEqual(
      planTaskLockedFocus({
        origin: { type: "WEEKLY_REPORT", reportId: "r1", examId: "e1", weekStart: "2026-11-09", subjectRef: null },
        subject: null,
        topic: null,
      }),
      { subject: null, topic: null },
    );
  });

  it("leaves the student's own and a coach's tasks editable", () => {
    assert.equal(planTaskLockedFocus({ origin: null, subject: "Tarih", topic: null }), null);
    assert.equal(
      planTaskLockedFocus({ origin: { type: "MENTORSHIP", linkId: "l1" }, subject: "Tarih", topic: null }),
      null,
    );
  });
});
