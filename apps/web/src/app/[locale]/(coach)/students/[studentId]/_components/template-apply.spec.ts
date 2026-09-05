import { describe, expect, it } from "vitest";
import { buildTemplateDrafts, toTemplateTasks, type DatedDraft } from "./template-apply";

const draft = (taskDate: string, over: Partial<DatedDraft> = {}): DatedDraft => ({
  title: "Paragraf 20 soru",
  subject: "Türkçe",
  topic: "Paragraf",
  coachNote: null,
  taskDate,
  ...over,
});

describe("toTemplateTasks", () => {
  it("normalizes to the program's own first day, not the calendar's", () => {
    // Saved from a week starting Thursday; the template must not remember Thursday.
    const tasks = toTemplateTasks([draft("2026-09-05"), draft("2026-09-03", { title: "İlk" })]);
    expect(tasks.map((task) => [task.dayIndex, task.title])).toEqual([
      [0, "İlk"],
      [2, "Paragraf 20 soru"],
    ]);
  });

  it("keeps offsets past a single week, because the composer can build them", () => {
    // Stepping the week button leaves earlier drafts in place, so a program spans up to 3 weeks.
    const tasks = toTemplateTasks([draft("2026-09-03"), draft("2026-09-23")]);
    expect(tasks.map((task) => task.dayIndex)).toEqual([0, 20]);
  });

  it("has nothing to save from an empty composer", () => {
    expect(toTemplateTasks([])).toEqual([]);
  });
});

describe("buildTemplateDrafts", () => {
  const template = {
    examType: "KPSS",
    tasks: [
      { dayIndex: 0, title: "İlk", subject: "Türkçe", topic: "Paragraf", coachNote: "Süre tut" },
      { dayIndex: 3, title: "İkinci", subject: "Matematik", topic: null, coachNote: null },
    ],
  };

  it("re-dates the program onto the week it is dropped on", () => {
    const load = buildTemplateDrafts(template, "2026-09-07", "KPSS", 21);
    expect(load.drafts.map((d) => [d.taskDate, d.title])).toEqual([
      ["2026-09-07", "İlk"],
      ["2026-09-10", "İkinci"],
    ]);
    expect(load.skipped).toBe(0);
    expect(load.clearedTopics).toBe(0);
    // The coach's own instruction travels with the task; it is their words, read back to them.
    expect(load.drafts[0]!.coachNote).toBe("Süre tut");
  });

  /**
   * The load-bearing one. `topic` is a soft ref into the content taxonomy and the API only checks
   * that a topic has a subject — never that it exists in THIS student's exam. Carrying a KPSS
   * topic onto a YKS student would write a label that means nothing and read back as if it did.
   */
  it("drops topics when the template was built for another exam, and says how many", () => {
    const load = buildTemplateDrafts(template, "2026-09-07", "YKS", 21);
    expect(load.clearedTopics).toBe(1);
    expect(load.drafts[0]!.topic).toBeNull();
    // The subject stays: it is a broad label the coach can type by hand and fix in the picker.
    expect(load.drafts[0]!.subject).toBe("Türkçe");
  });

  it("carries topics when the template is exam-agnostic", () => {
    const agnostic = { examType: null, tasks: template.tasks };
    const load = buildTemplateDrafts(agnostic, "2026-09-07", "YKS", 21);
    expect(load.clearedTopics).toBe(0);
    expect(load.drafts[0]!.topic).toBe("Paragraf");
  });

  it("reports what did not fit rather than quietly thinning the program", () => {
    const load = buildTemplateDrafts(template, "2026-09-07", "KPSS", 1);
    expect(load.drafts).toHaveLength(1);
    expect(load.drafts[0]!.title).toBe("İlk");
    expect(load.skipped).toBe(1);
  });

  it("loads nothing, and skips everything, at the ceiling", () => {
    const load = buildTemplateDrafts(template, "2026-09-07", "KPSS", 0);
    expect(load.drafts).toEqual([]);
    expect(load.skipped).toBe(2);
  });
});
