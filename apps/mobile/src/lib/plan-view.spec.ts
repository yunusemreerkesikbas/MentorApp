import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planTaskCreateInput, planTaskFormValues } from "@mentor/core";

import type { PlanTaskDto } from "@mentor/types";
import {
  apiErrorCode,
  errorText,
  dateSheetMonthDays,
  monthGridWeeks,
  newPlanTaskDraft,
  parsePlanDateLink,
  parsePlanTaskPrefill,
  weeklyReportTaskInput,
  selectedDayForWeek,
  shiftPlanWeek,
  withTaskStatus,
} from "./plan-view.ts";

describe("selectedDayForWeek", () => {
  it("falls back to the week's Monday when neither day is in it", () => {
    assert.equal(selectedDayForWeek("2026-11-16", "2026-11-13", "2026-11-13"), "2026-11-16");
  });

  it("picks today when today is in the new week", () => {
    assert.equal(selectedDayForWeek("2026-11-09", "2026-11-20", "2026-11-13"), "2026-11-13");
  });

  it("keeps the selected day when it is in the week", () => {
    assert.equal(selectedDayForWeek("2026-11-09", "2026-11-11", "2026-11-13"), "2026-11-11");
  });
});

describe("monthGridWeeks", () => {
  it("splits the grid into Monday-to-Sunday rows of seven", () => {
    const weeks = monthGridWeeks("2026-11-13");
    assert.equal(weeks.length, 6);
    assert.ok(weeks.every((week) => week.length === 7));
    assert.deepEqual([weeks[0]![0], weeks[0]![6]], ["2026-10-26", "2026-11-01"]);
    assert.equal(weeks[1]![0], "2026-11-02");
  });
});

describe("dateSheetMonthDays", () => {
  it("covers the month in Monday-first whole weeks", () => {
    const days = dateSheetMonthDays("2026-11-13");
    assert.equal(days.length, 42);
    assert.equal(days[0], "2026-10-26");
    assert.equal(days.at(-1), "2026-12-06");
  });

  it("starts the week before a month that begins on a Sunday", () => {
    assert.equal(dateSheetMonthDays("2026-02-01")[0], "2026-01-26");
  });

  it("runs into the next year for December", () => {
    const days = dateSheetMonthDays("2026-12-31");
    assert.equal(days.length % 7, 0);
    assert.equal(days.at(-1), "2027-01-03");
  });
});

describe("withTaskStatus", () => {
  const task = (id: string, taskDate: string) =>
    ({ id, taskDate, status: "PENDING" }) as PlanTaskDto;

  it("flips only the matching task and leaves other days untouched", () => {
    const other = [task("b", "2026-11-14")];
    const byDay = {
      "2026-11-13": [task("a", "2026-11-13"), task("c", "2026-11-13")],
      "2026-11-14": other,
    };
    const next = withTaskStatus(byDay, "a", "DONE");
    assert.equal(next["2026-11-13"]![0]!.status, "DONE");
    assert.equal(next["2026-11-13"]![1]!.status, "PENDING");
    assert.equal(next["2026-11-14"], other);
    assert.equal(byDay["2026-11-13"]![0]!.status, "PENDING");
  });
});

describe("errorText", () => {
  it("shows the API's own (already Turkish) message", () => {
    // The shape `ApiClientError` builds (its dist does not load under node:test).
    const error = Object.assign(new Error("Analiz odağı değişti."), { name: "ApiClientError" });
    assert.equal(errorText(error, "Bir şeyler ters gitti."), "Analiz odağı değişti.");
  });

  it("falls back for anything else, e.g. an offline fetch's English TypeError", () => {
    assert.equal(errorText(new TypeError("Network request failed"), "Bir şeyler ters gitti."), "Bir şeyler ters gitti.");
    assert.equal(errorText("boom", "Bir şeyler ters gitti."), "Bir şeyler ters gitti.");
  });
});

describe("apiErrorCode", () => {
  it("reads the API's error code and nothing from other errors", () => {
    const error = Object.assign(new Error("x"), { name: "ApiClientError", body: { code: "INSUFFICIENT_COIN" } });
    assert.equal(apiErrorCode(error), "INSUFFICIENT_COIN");
    assert.equal(apiErrorCode(new Error("x")), null);
  });
});

describe("shiftPlanWeek", () => {
  it("composes: two quick taps move two weeks, not one", () => {
    const start = { anchor: "2026-11-09", selected: "2026-11-15" };
    const once = shiftPlanWeek(start, 7, "2026-11-14");
    const twice = shiftPlanWeek(once, 7, "2026-11-14");
    assert.deepEqual(once, { anchor: "2026-11-16", selected: "2026-11-16" });
    assert.deepEqual(twice, { anchor: "2026-11-23", selected: "2026-11-23" });
  });

  it("lands on today when coming back to its week, across a year end", () => {
    assert.deepEqual(shiftPlanWeek({ anchor: "2027-01-04", selected: "2027-01-04" }, -7, "2026-12-30"), {
      anchor: "2026-12-28",
      selected: "2026-12-30",
    });
  });
});

describe("newPlanTaskDraft", () => {
  it("creates an all-day task when the add flow did not supply a slot", () => {
    const draft = { ...newPlanTaskDraft(), title: "Tekrar" };
    const input = planTaskCreateInput(planTaskFormValues(draft), "2026-11-25");
    assert.equal(input.taskDate, "2026-11-25");
    assert.equal(input.startTime, undefined);
  });

  it("prefills and serializes the selected hour, including the last hour of the day", () => {
    for (const [start, end] of [["00:00", "01:00"], ["14:00", "15:00"], ["23:00", "23:59"]] as const) {
      const draft = { ...newPlanTaskDraft(start), title: "Tekrar" };
      const input = planTaskCreateInput(planTaskFormValues(draft), "2026-11-25");
      assert.deepEqual([draft.allDay, input.startTime, input.endTime], [false, start, end]);
    }
  });
});

describe("Plan task prefill", () => {
  it("builds an all-day editable draft from the recap suggestion", () => {
    const prefill = parsePlanTaskPrefill({ add: "1", title: " Paragraf tekrarı ", subject: " Türkçe " });
    assert.ok(prefill);
    const draft = newPlanTaskDraft(undefined, prefill);
    assert.deepEqual([draft.title, draft.subject, draft.allDay], ["Paragraf tekrarı", "Türkçe", true]);
  });

  it("only opens on an explicit request with a usable single title", () => {
    assert.equal(parsePlanTaskPrefill({ add: "0", title: "Tekrar" }), null);
    assert.equal(parsePlanTaskPrefill({ add: "1", title: "  " }), null);
    assert.equal(parsePlanTaskPrefill({ add: "1", title: ["Tekrar", "Konu"] }), null);
  });

  it("limits the prefilled fields to what the task form accepts", () => {
    const prefill = parsePlanTaskPrefill({ add: "1", title: "a".repeat(201), subject: "b".repeat(81) });
    assert.deepEqual(prefill, { title: "a".repeat(200), subject: "b".repeat(80) });
    assert.deepEqual(parsePlanTaskPrefill({ add: "1", title: "Tekrar", subject: ["A", "B"] }), {
      title: "Tekrar", subject: "",
    });
  });
});

describe("weekly report task", () => {
  it("keeps editable plan fields and leaves the report subject for the server", () => {
    const values = planTaskFormValues({
      ...newPlanTaskDraft("16:00", { title: " Review ", subject: "Mathematics" }),
      description: " Review the notes ",
      duration: "25",
    });
    assert.deepEqual(weeklyReportTaskInput(values, "2026-11-16"), {
      title: "Review", taskDate: "2026-11-16", startTime: "16:00", endTime: "17:00",
      description: "Review the notes", durationMinutes: 25,
    });
  });
});

describe("plan date links", () => {
  it("accepts a real calendar day, including a leap day", () => {
    assert.equal(parsePlanDateLink("2028-02-29"), "2028-02-29");
    assert.equal(parsePlanDateLink("2026-11-01"), "2026-11-01");
  });

  it("rejects impossible days, timestamps and repeated route parameters", () => {
    assert.equal(parsePlanDateLink("2027-02-29"), null);
    assert.equal(parsePlanDateLink("2026-11-01T00:00:00Z"), null);
    assert.equal(parsePlanDateLink(["2026-11-01"]), null);
  });
});
