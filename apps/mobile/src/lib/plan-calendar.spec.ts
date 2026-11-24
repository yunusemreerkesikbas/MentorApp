import assert from "node:assert/strict";
import { it } from "node:test";
import { PLAN_EVENT_NEUTRAL_SWATCH, weekStart } from "@mentor/core";
import type { PlanEventDto, PlanTaskDto } from "@mentor/types";
import { mixHex } from "./layout.ts";
import {
  agendaActiveDay,
  boardDays,
  boardWeekRow,
  calendarItemsByDate,
  dayGridInitialOffset,
  followDay,
  highlightedSubject,
  initialPlanCalendarState,
  legendSubjects,
  pickDay,
  planEventTint,
  readPlanCalendarScale,
  stepCalendar,
  type PlanCalendarState,
} from "./plan-calendar.ts";

const nov = (patch: Partial<PlanCalendarState> = {}): PlanCalendarState => ({ anchor: "2026-11-23", selected: "2026-11-25", month: "2026-11-01", monthStep: null, ...patch });

it("restores the three calendar scales and defaults to Ajanda", () => {
  for (const scale of ["day", "week", "month"]) assert.equal(readPlanCalendarScale(scale), scale);
  for (const raw of ["garbage", "", null]) assert.equal(readPlanCalendarScale(raw), "week");
});

it("steps Gün one date at a time in both directions, even across the year boundary", () => {
  const today = "2026-11-15";
  const dec31 = initialPlanCalendarState("2026-12-31");
  const jan1 = stepCalendar(dec31, "day", 1, today);
  assert.deepEqual(jan1, {
    anchor: "2026-12-28",
    selected: "2027-01-01",
    month: "2027-01-01",
    monthStep: null,
  });
  assert.deepEqual(stepCalendar(jan1, "day", -1, today), dec31);
});

it("steps Gün from the selected spill day and takes the new day's month", () => {
  const spill = followDay(nov(), "2026-12-03");
  const next = stepCalendar(spill, "day", 1, "2026-11-15");
  assert.equal(next.selected, "2026-12-04");
  assert.equal(next.month, "2026-12-01");
});

it("opens the hour grid half an hour before the earliest timed item", () => {
  const items = [
    { startTime: "13:00", endTime: null },
    { startTime: null, endTime: null },
    { startTime: "09:30", endTime: "10:45" },
  ];
  assert.equal(dayGridInitialOffset(items), 504);
});

it("shows 07:00 when there are only all-day items and clamps midnight to the top", () => {
  assert.equal(dayGridInitialOffset([{ startTime: null, endTime: null }]), 364);
  assert.equal(dayGridInitialOffset([{ startTime: "00:05", endTime: "00:15" }]), 0);
});
it("a pick takes the day's month, a spill day included", () => {
  assert.deepEqual(pickDay(nov(), "2026-12-02"), { anchor: "2026-11-30", selected: "2026-12-02", month: "2026-12-01", monthStep: null });
});
it("a scroll keeps the board month while its grid holds the day", () => {
  assert.equal(followDay(nov(), "2026-12-06").month, "2026-11-01");
  assert.equal(followDay(nov(), "2026-12-07").month, "2026-12-01");
});
it("Ajanda steps keep the month until the week leaves the grid, both ways", () => {
  const a = stepCalendar(nov(), "week", 1, "2026-11-15");
  assert.deepEqual([a.anchor, a.selected, a.month], ["2026-11-30", "2026-11-30", "2026-11-01"]);
  const b = stepCalendar(a, "week", 1, "2026-11-15");
  assert.deepEqual([b.anchor, b.selected, b.month], ["2026-12-07", "2026-12-07", "2026-12-01"]);
  assert.equal(stepCalendar(b, "week", -1, "2026-11-15").month, "2026-12-01"); // 30 Nov is in December's grid
});
it("Ay steps keep the day across short months", () => {
  const jan = nov({ anchor: "2027-01-25", selected: "2027-01-31", month: "2027-01-01" });
  const feb = stepCalendar(jan, "month", 1, "2026-11-15");
  assert.deepEqual([feb.selected, feb.month], ["2027-02-28", "2027-02-01"]);
  assert.equal(stepCalendar(feb, "month", 1, "2026-11-15").selected, "2027-03-31");
});
it("steps from the visible Ay month after Ajanda selects a spill date", () => {
  const today = "2026-11-15";
  const lastRow = followDay(nov(), "2026-12-03");
  assert.equal(stepCalendar(lastRow, "month", 1, today).selected, "2026-12-03");
  assert.equal(stepCalendar(lastRow, "month", -1, today).selected, "2026-10-03");

  const firstRow = followDay(nov(), "2026-10-29");
  assert.equal(stepCalendar(firstRow, "month", -1, today).selected, "2026-10-29");
});

it("keeps week and month steps on the right dates in Auckland", () => {
  const oldTimezone = process.env.TZ;
  process.env.TZ = "Pacific/Auckland";
  try {
    const today = "2026-11-15";
    const start = initialPlanCalendarState(today);
    const next = stepCalendar(start, "week", 1, today);
    assert.deepEqual([start.anchor, next.anchor, next.selected], ["2026-11-09", "2026-11-16", "2026-11-16"]);
    assert.equal(stepCalendar(nov(), "month", 1, today).selected, "2026-12-25");
  } finally {
    if (oldTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = oldTimezone;
  }
});

it("the board always holds the selected day", () => {
  let s = initialPlanCalendarState("2026-11-15");
  const ops: ((x: PlanCalendarState) => PlanCalendarState)[] = [(x) => followDay(x, "2026-12-03"), (x) => stepCalendar(x, "week", 1, "2026-11-15"), (x) => stepCalendar(x, "week", -1, "2026-11-15"), (x) => pickDay(x, "2026-10-27"), (x) => stepCalendar(x, "month", -1, "2026-11-15"), (x) => followDay(x, "2026-09-28")];
  for (const op of ops) { s = op(s); assert.ok(boardDays(s.month).includes(s.selected), `${s.month} ${s.selected}`); assert.equal(s.anchor, weekStart(s.selected)); }
});
it("finds the selected week's row", () => {
  const days = boardDays("2026-11-01");
  assert.deepEqual([boardWeekRow(days, "2026-11-15"), boardWeekRow(days, "2026-12-06"), boardWeekRow(days, "2026-10-26")], [2, 5, 0]);
});
it("spies the last day whose top has passed the fold", () => {
  const tops = [{ iso: "a", top: 0 }, { iso: "b", top: 100 }, { iso: "c", top: 250 }];
  assert.deepEqual([0, 91, 92, 1000].map((y) => agendaActiveDay(tops, y)), ["a", "a", "b", "c"]);
  assert.equal(agendaActiveDay([], 0), null);
});
it("lists the month's subjects, busiest first, then by Turkish name", () => {
  const byDate = { "2026-11-03": [{ subject: "Tarih" }, { subject: "Fizik" }], "2026-11-04": [{ subject: " Tarih " }, { subject: null }, { subject: "Coğrafya" }], "2026-12-01": [{ subject: "Tarih" }] };
  assert.deepEqual(legendSubjects(byDate, "2026-11"), [{ subject: "Tarih", count: 2 }, { subject: "Coğrafya", count: 1 }, { subject: "Fizik", count: 1 }]);
  assert.equal(highlightedSubject("Fizik", byDate, "2026-11"), "Fizik");
  assert.equal(highlightedSubject("Fizik", byDate, "2026-12"), null);
});
const palette = { progress: "#55ACEE", chip: "#BEA1FE", thumbViolet: "#DDACE5", success: "#15803D", star: "#FBBF24", secondary: "#4B5563", surface: "#FFFFFF" };
it("tints a swatch over the surface", () => {
  assert.deepEqual(planEventTint({ token: "progress", tint: 18 }, palette), { bar: "#55ACEE", bg: mixHex("#55ACEE", "#FFFFFF", 0.18) });
});
it("puts a day's tasks before its meetings", () => {
  const task = { id: "t1", taskDate: "2026-11-03", title: "Tekrar", subject: "Tarih", status: "PENDING", startTime: "20:00", endTime: null, description: null } as PlanTaskDto;
  const meeting = { id: "e1", eventDate: "2026-11-03", title: "Görüşme", startTime: "09:00", endTime: "09:30", description: null, status: "SCHEDULED", organizerUserId: "coach" } as PlanEventDto;
  const out = calendarItemsByDate({ "2026-11-03": [task] }, { "2026-11-03": [meeting] }, "me", { done: "D", hint: "H", withCoach: "Koçunla", cancelled: "İptal" }, palette);
  assert.deepEqual(out["2026-11-03"]?.map((item) => item.id), ["t1", "e1"]);
  assert.deepEqual(out["2026-11-03"]?.[1]?.color, planEventTint(PLAN_EVENT_NEUTRAL_SWATCH, palette));
});
