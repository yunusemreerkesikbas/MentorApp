// The repository reuses apps/api's Vitest runner; apps/web intentionally has no test dependency.
// @ts-expect-error -- resolved by the explicit @mentor/api Vitest command used for this spec.
import { describe, expect, it } from "vitest";
import {
  formatPlannedMinutes,
  summarizeSubjectMonth,
  type SummarizableTask,
} from "./plan-subject-summary";

const MONTH = "2026-07";
const TODAY = "2026-07-20";

const task = (
  title: string,
  overrides: Partial<SummarizableTask> = {},
): SummarizableTask => ({
  title,
  subject: "Matematik",
  status: "PENDING",
  startTime: null,
  endTime: null,
  ...overrides,
});

describe("summarizeSubjectMonth", () => {
  it("counts only the named subject, and only inside the anchor month", () => {
    const s = summarizeSubjectMonth(
      "Matematik",
      {
        // Leading spill day from June — visible on the board, not part of "this month".
        "2026-06-29": [task("Haziran")],
        "2026-07-10": [task("A"), task("B", { subject: "Türkçe" })],
        "2026-07-11": [task("C", { status: "DONE" })],
      },
      MONTH,
      TODAY,
    );
    // Only A (10th) and C (11th) are Matematik — B is Türkçe, and the 29 June cell is spill.
    expect(s.total).toBe(2);
    expect(s.done).toBe(1);
    expect(s.percent).toBe(50);
    expect(s.dayCount).toBe(2);
  });

  it("returns a zeroed summary when the subject is absent", () => {
    const s = summarizeSubjectMonth("Fizik", { "2026-07-10": [task("A")] }, MONTH, TODAY);
    expect(s).toMatchObject({ total: 0, done: 0, percent: 0, dayCount: 0, next: null });
    expect(s.plannedMinutes).toBeNull();
  });

  it("sums timed durations and treats an open-ended item as one hour", () => {
    const s = summarizeSubjectMonth(
      "Matematik",
      {
        "2026-07-10": [task("A", { startTime: "13:00", endTime: "14:30" })],
        "2026-07-11": [task("B", { startTime: "09:00" })],
      },
      MONTH,
      TODAY,
    );
    expect(s.plannedMinutes).toBe(90 + 60);
  });

  it("reports null planned minutes when every task is all-day", () => {
    const s = summarizeSubjectMonth(
      "Matematik",
      { "2026-07-10": [task("A"), task("B")] },
      MONTH,
      TODAY,
    );
    expect(s.plannedMinutes).toBeNull();
  });

  it("picks the nearest task from today onward, preferring an unfinished one", () => {
    const s = summarizeSubjectMonth(
      "Matematik",
      {
        "2026-07-10": [task("Geçmiş")],
        "2026-07-20": [task("Bugün bitmiş", { status: "DONE" }), task("Bugün açık")],
        "2026-07-28": [task("Sonra")],
      },
      MONTH,
      TODAY,
    );
    expect(s.next).toEqual({ date: "2026-07-20", title: "Bugün açık" });
  });

  it("has no next when every occurrence is in the past", () => {
    const s = summarizeSubjectMonth(
      "Matematik",
      { "2026-07-10": [task("A")], "2026-07-11": [task("B")] },
      MONTH,
      TODAY,
    );
    expect(s.next).toBeNull();
  });

  it("is not fooled by unsorted keys", () => {
    const s = summarizeSubjectMonth(
      "Matematik",
      {
        "2026-07-28": [task("Geç")],
        "2026-07-21": [task("Erken")],
      },
      MONTH,
      TODAY,
    );
    expect(s.next?.title).toBe("Erken");
  });

  it("trims subject whitespace on the task side", () => {
    const s = summarizeSubjectMonth(
      "Matematik",
      { "2026-07-10": [task("A", { subject: " Matematik " })] },
      MONTH,
      TODAY,
    );
    expect(s.total).toBe(1);
  });
});

describe("formatPlannedMinutes", () => {
  const labels = { hour: "sa", minute: "dk" };

  it("formats hours and minutes", () => {
    expect(formatPlannedMinutes(210, labels)).toBe("3 sa 30 dk");
    expect(formatPlannedMinutes(120, labels)).toBe("2 sa");
    expect(formatPlannedMinutes(45, labels)).toBe("45 dk");
  });
});
