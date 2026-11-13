import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  planTaskCreateInput,
  planTaskDraftError,
  planTaskFormValues,
  planTaskUpdateInput,
  plusOneHour,
  endTimeAfterStart,
  type PlanTaskDraft,
} from "../dist/index.js";

const draft = (overrides: Partial<PlanTaskDraft> = {}): PlanTaskDraft => ({
  title: "Paragraf 30 soru",
  subject: "",
  allDay: true,
  startTime: "09:00",
  endTime: "10:00",
  description: "",
  duration: "",
  ...overrides,
});

describe("planTaskDraftError", () => {
  it("checks the duration first, then the title, then the times", () => {
    assert.equal(planTaskDraftError(draft({ title: "  ", duration: "3" })), "duration_invalid");
    assert.equal(planTaskDraftError(draft({ duration: "201" })), "duration_invalid");
    assert.equal(planTaskDraftError(draft({ duration: "40.5" })), "duration_invalid");
    assert.equal(planTaskDraftError(draft({ title: "  " })), "task_required");
    assert.equal(
      planTaskDraftError(draft({ allDay: false, startTime: "09:00", endTime: "09:00" })),
      "time_invalid",
    );
  });

  it("accepts an open end, an all-day task and the duration limits", () => {
    assert.equal(planTaskDraftError(draft({ allDay: false, endTime: "" })), null);
    assert.equal(planTaskDraftError(draft({ startTime: "x", endTime: "y" })), null);
    assert.equal(planTaskDraftError(draft({ duration: "5" })), null);
    assert.equal(planTaskDraftError(draft({ duration: "200" })), null);
  });
});

describe("plusOneHour", () => {
  it("adds an hour and stops at 23", () => {
    assert.equal(plusOneHour("09:30"), "10:30");
    assert.equal(plusOneHour("23:15"), "23:15");
  });
});

describe("endTimeAfterStart", () => {
  it("keeps an end that is still after the new start", () => {
    assert.equal(endTimeAfterStart("09:15", "10:00"), "10:00");
  });
  it("moves an end at or before the new start to an hour later", () => {
    assert.equal(endTimeAfterStart("14:15", "10:00"), "15:15");
    assert.equal(endTimeAfterStart("10:00", "10:00"), "11:00");
    assert.equal(endTimeAfterStart("9:05", "09:00"), "10:05");
  });
  it("leaves an unreadable time alone", () => {
    assert.equal(endTimeAfterStart("", "10:00"), "10:00");
    assert.equal(endTimeAfterStart("14:00", ""), "");
  });
});

describe("planTaskFormValues", () => {
  it("drops the times for an all-day task and normalises the rest", () => {
    assert.deepEqual(planTaskFormValues(draft({ description: "  ", duration: "" })), {
      title: "Paragraf 30 soru",
      subject: "",
      startTime: null,
      endTime: null,
      description: null,
      durationMinutes: null,
    });
    const timed = planTaskFormValues(
      draft({ allDay: false, startTime: "9:05", endTime: "", description: " not ", duration: "40" }),
    );
    assert.equal(timed.startTime, "09:05");
    assert.equal(timed.endTime, null);
    assert.equal(timed.description, "not");
    assert.equal(timed.durationMinutes, 40);
  });
});

describe("planTaskCreateInput", () => {
  it("sends only what was filled in", () => {
    const values = planTaskFormValues(draft({ title: " Tekrar ", subject: "  " }));
    assert.deepEqual(planTaskCreateInput(values, "2026-11-13"), {
      title: "Tekrar",
      taskDate: "2026-11-13",
      durationMinutes: null,
    });
    const full = planTaskFormValues(
      draft({ allDay: false, subject: " Tarih ", description: "kısa", duration: "30" }),
    );
    assert.deepEqual(planTaskCreateInput(full, "2026-11-14"), {
      title: "Paragraf 30 soru",
      taskDate: "2026-11-14",
      subject: "Tarih",
      startTime: "09:00",
      endTime: "10:00",
      description: "kısa",
      durationMinutes: 30,
    });
  });
});

describe("planTaskUpdateInput", () => {
  it("always sends the time pair and clears a blank subject", () => {
    const values = planTaskFormValues(draft({ subject: " " }));
    assert.deepEqual(planTaskUpdateInput(values, { origin: null, subject: "Eski" }), {
      title: "Paragraf 30 soru",
      subject: null,
      startTime: null,
      endTime: null,
      description: null,
      durationMinutes: null,
    });
  });

  it("keeps a weekly-report task's subject", () => {
    const values = planTaskFormValues(draft({ subject: "Başka" }));
    const input = planTaskUpdateInput(values, {
      origin: { type: "WEEKLY_REPORT", weeklyReportId: "r1" },
      subject: "Ritim",
    } as never);
    assert.equal(input.subject, "Ritim");
  });
});
