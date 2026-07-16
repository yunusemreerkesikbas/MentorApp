import { describe, expect, it } from "vitest";
import { parsePlanDraft } from "./plan-draft";

const TODAY = "2026-07-15";

const draft = (days: unknown) => JSON.stringify({ days });

describe("parsePlanDraft", () => {
  it("parses a valid draft and sorts days chronologically", () => {
    const out = parsePlanDraft(
      draft([
        { date: "2026-07-16", tasks: [{ title: "Paragraf: 20 soru", subject: "Türkçe" }] },
        { date: "2026-07-15", tasks: [{ title: "Sayılar tekrarı", subject: "Matematik" }] },
      ]),
      TODAY,
    );
    expect(out).toEqual([
      { date: "2026-07-15", tasks: [{ title: "Sayılar tekrarı", subject: "Matematik" }] },
      { date: "2026-07-16", tasks: [{ title: "Paragraf: 20 soru", subject: "Türkçe" }] },
    ]);
  });

  it("tolerates code fences and prose around the JSON", () => {
    const text = `İşte planın:\n\`\`\`json\n${draft([
      { date: TODAY, tasks: [{ title: "Deneme çöz" }] },
    ])}\n\`\`\`\nBaşarılar!`;
    const out = parsePlanDraft(text, TODAY);
    expect(out).toEqual([{ date: TODAY, tasks: [{ title: "Deneme çöz", subject: null }] }]);
  });

  it("drops dates outside [today, today+6]", () => {
    const out = parsePlanDraft(
      draft([
        { date: "2026-07-14", tasks: [{ title: "Dün" }] },
        { date: "2026-07-21", tasks: [{ title: "İçinde" }] },
        { date: "2026-07-22", tasks: [{ title: "Dışında" }] },
      ]),
      TODAY,
    );
    expect(out).toEqual([{ date: "2026-07-21", tasks: [{ title: "İçinde", subject: null }] }]);
  });

  it("clamps to 3 tasks per day and skips empty titles", () => {
    const out = parsePlanDraft(
      draft([
        {
          date: TODAY,
          tasks: [
            { title: "a" },
            { title: "  " },
            { title: "b" },
            { title: "c" },
            { title: "d" },
          ],
        },
      ]),
      TODAY,
    );
    expect(out?.[0]?.tasks.map((t) => t.title)).toEqual(["a", "b", "c"]);
  });

  it("clamps the total to 15 tasks", () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(`${TODAY}T00:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() + i);
      days.push({
        date: d.toISOString().slice(0, 10),
        tasks: [{ title: `g${i}-1` }, { title: `g${i}-2` }, { title: `g${i}-3` }],
      });
    }
    const out = parsePlanDraft(draft(days), TODAY);
    const total = out?.reduce((sum, day) => sum + day.tasks.length, 0);
    expect(total).toBe(15);
  });

  it("returns null on broken JSON or an unusable shape", () => {
    expect(parsePlanDraft("plan yapamadım", TODAY)).toBeNull();
    expect(parsePlanDraft('{"days": "yok"}', TODAY)).toBeNull();
    expect(parsePlanDraft(draft([{ date: "2026-09-01", tasks: [{ title: "x" }] }]), TODAY)).toBeNull();
  });
});
