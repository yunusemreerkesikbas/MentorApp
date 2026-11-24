import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlanEventDto, PlanTaskDto } from "@mentor/types";
import {
  formatPlannedMinutes,
  layoutDayEvents,
  monthGridDays,
  planEventSwatch,
  planTaskCalendarItem,
  spotlightDelay,
  studentEventCalendarItem,
  summarizeSubjectMonth,
} from "../dist/index.js";

describe("monthGridDays", () => {
  it("always gives six Monday-first weeks", () => {
    const nov = monthGridDays(2026, 10);
    assert.equal(nov.length, 42);
    assert.deepEqual([nov[0], nov[41]], ["2026-10-26", "2026-12-06"]);
    assert.equal(monthGridDays(2026, 1)[0], "2026-01-26"); // 1 Feb 2026 is a Sunday
  });
});

describe("layoutDayEvents", () => {
  it("puts all-day items aside and orders timed ones by start", () => {
    const out = layoutDayEvents([
      { startTime: "10:00", endTime: null },
      { startTime: null, endTime: null },
      { startTime: "08:30", endTime: "09:00" },
    ]);
    assert.equal(out.allDay.length, 1);
    assert.deepEqual(out.timed.map((t) => t.event.startTime), ["08:30", "10:00"]);
  });
});

describe("planEventSwatch", () => {
  it("keeps the web's buckets", () => {
    const token = (s: string) => planEventSwatch(s).token;
    assert.deepEqual(
      ["Tarih", "Coğrafya", "Matematik", "Fizik", "Türkçe"].map(token),
      ["progress", "chip", "thumbViolet", "success", "star"],
    );
    assert.deepEqual(planEventSwatch(" Tarih "), planEventSwatch("Tarih"));
  });

  it("gives no subject the neutral swatch", () => {
    for (const s of [null, undefined, "", "   "]) {
      assert.deepEqual(planEventSwatch(s), { token: "secondary", tint: 12 });
    }
  });
});

describe("calendar items", () => {
  const labels = { done: "D", hint: "H" };

  it("maps a done task with its trimmed subject", () => {
    const item = planTaskCalendarItem(
      { id: "t", taskDate: "2026-11-03", title: "Tekrar", subject: " Tarih ", status: "DONE", startTime: null, endTime: null, description: null } as PlanTaskDto,
      labels,
      (s) => `c:${s}`,
    );
    assert.deepEqual([item.color, item.meta, item.groupKey, item.muted, item.hint], ["c:Tarih", "Tarih", "Tarih", true, "D"]);
  });

  it("labels a coach's meeting and mutes a cancelled one", () => {
    const eventLabels = { withCoach: "Koçunla", cancelled: "İptal" };
    const base = { id: "e", eventDate: "2026-11-03", title: "Görüşme", startTime: "18:00", endTime: "18:30", description: null, status: "SCHEDULED", organizerUserId: "coach" } as PlanEventDto;
    const item = studentEventCalendarItem(base, "me", eventLabels, "N");
    assert.deepEqual([item.meta, item.groupKey, item.glyph, item.color, item.muted], ["Koçunla", null, "event", "N", false]);
    const own = studentEventCalendarItem({ ...base, organizerUserId: "me", status: "CANCELLED" } as PlanEventDto, "me", eventLabels, "N");
    assert.deepEqual([own.meta, own.muted, own.hint], [null, true, "İptal"]);
  });
});

describe("summarizeSubjectMonth", () => {
  const task = (status: string, startTime: string | null = null, endTime: string | null = null, durationMinutes: number | null = null) =>
    ({ title: `T${status}`, subject: "Tarih", status, startTime, endTime, durationMinutes });

  it("counts the month only, adds planned minutes and finds the next task", () => {
    const s = summarizeSubjectMonth("Tarih", {
      "2026-11-03": [task("DONE", null, null, 45)],
      "2026-11-10": [task("PENDING", "09:00", "10:30")],
      "2026-11-20": [task("PENDING")],
      "2026-12-01": [task("PENDING")],
    }, "2026-11", "2026-11-15");
    assert.deepEqual([s.done, s.total, s.percent, s.dayCount, s.plannedMinutes], [1, 3, 33, 3, 135]);
    assert.equal(s.next?.date, "2026-11-20");
  });

  it("formats planned minutes", () => {
    const l = { hour: "sa", minute: "dk" };
    assert.deepEqual([formatPlannedMinutes(210, l), formatPlannedMinutes(45, l), formatPlannedMinutes(120, l)], ["3 sa 30 dk", "45 dk", "2 sa"]);
  });
});

describe("spotlightDelay", () => {
  it("steps 25 ms and caps at 400", () => {
    assert.deepEqual([0, 3, 100].map(spotlightDelay), [0, 75, 400]);
  });
});
