import { describe, expect, it } from "vitest";
import { createTaskMarkerFilter, extractSuggestedTask } from "./suggested-task";

const MARKER = '<<TASK{"title":"Matematik: 20 soru çöz","subject":"Matematik"}>>';

describe("extractSuggestedTask", () => {
  it("parses and strips a trailing marker", () => {
    const { text, task } = extractSuggestedTask(`Harika bir hedef!\n${MARKER}`);
    expect(text).toBe("Harika bir hedef!");
    expect(task).toEqual({ title: "Matematik: 20 soru çöz", subject: "Matematik" });
  });

  it("returns text untouched when there is no marker", () => {
    const { text, task } = extractSuggestedTask("Sade bir yanıt.");
    expect(text).toBe("Sade bir yanıt.");
    expect(task).toBeNull();
  });

  it("strips the marker but suggests nothing on broken JSON", () => {
    const { text, task } = extractSuggestedTask('Yanıt. <<TASK{"title": bozuk}>>');
    expect(text).toBe("Yanıt.");
    expect(task).toBeNull();
  });

  it("treats a missing/empty title as no suggestion (marker still stripped)", () => {
    const { text, task } = extractSuggestedTask('Yanıt. <<TASK{"subject":"Tarih"}>>');
    expect(text).toBe("Yanıt.");
    expect(task).toBeNull();
  });

  it("null subject when subject is absent", () => {
    const { task } = extractSuggestedTask('Y. <<TASK{"title":"Deneme çöz"}>>');
    expect(task).toEqual({ title: "Deneme çöz", subject: null });
  });
});

describe("createTaskMarkerFilter", () => {
  it("passes plain text through", () => {
    const f = createTaskMarkerFilter();
    expect(f.push("Merhaba ") + f.push("dünya") + f.flush()).toBe("Merhaba dünya");
  });

  it("suppresses a marker split across delta boundaries", () => {
    const f = createTaskMarkerFilter();
    const out =
      f.push("Bugün 20 soru çöz. <<TA") +
      f.push('SK{"title":"Matematik: 20 soru çöz","subject":"Matematik"}') +
      f.push(">>") +
      f.flush();
    expect(out).toBe("Bugün 20 soru çöz. ");
    expect(out).not.toContain("<<TASK");
  });

  it("releases a false-positive hold ('<<' that never becomes a marker)", () => {
    const f = createTaskMarkerFilter();
    const out = f.push("a <<T") + f.push("işaret değil") + f.flush();
    expect(out).toBe("a <<Tişaret değil");
  });

  it("drops a truncated marker at flush (stream cut mid-JSON)", () => {
    const f = createTaskMarkerFilter();
    const out = f.push('Yanıt. <<TASK{"title":"yarı') + f.flush();
    expect(out).toBe("Yanıt. ");
  });
});
