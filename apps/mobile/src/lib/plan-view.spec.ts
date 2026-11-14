import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlanTaskDto } from "@mentor/types";
import {
  apiErrorCode,
  errorText,
  monthGridDays,
  monthGridWeeks,
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

describe("monthGridDays", () => {
  it("covers the month in Monday-first whole weeks", () => {
    const days = monthGridDays("2026-11-13");
    assert.equal(days.length, 42);
    assert.equal(days[0], "2026-10-26");
    assert.equal(days.at(-1), "2026-12-06");
  });

  it("starts the week before a month that begins on a Sunday", () => {
    assert.equal(monthGridDays("2026-02-01")[0], "2026-01-26");
  });

  it("runs into the next year for December", () => {
    const days = monthGridDays("2026-12-31");
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
