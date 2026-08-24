import { describe, expect, it } from "vitest";
import {
  createTaskMarkerFilter,
  extractFollowUps,
  extractReplyMarkers,
  extractSuggestedTask,
} from "./suggested-task";

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

  it("recovers a malformed trailing marker (extra }, missing >>)", () => {
    const { text, task } = extractSuggestedTask(
      'Tebrikler!\n<<TASK{"title":"mola teknikleri","subject":""}}',
    );
    expect(text).toBe("Tebrikler!");
    expect(task).toEqual({ title: "mola teknikleri", subject: null });
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

  it("suppresses a FOLLOWUP marker split across delta boundaries", () => {
    const f = createTaskMarkerFilter();
    const out =
      f.push("Kolay gelsin. <<FOLLOW") + f.push('UP["Soru bir?","Soru iki?"]') + f.push(">>") + f.flush();
    expect(out).toBe("Kolay gelsin. ");
    expect(out).not.toContain("<<FOLLOWUP");
  });

  it("suppresses FOLLOWUP followed by TASK (order contract)", () => {
    const f = createTaskMarkerFilter();
    const out =
      f.push('Yanıt. <<FOLLOWUP["Soru?"]>>\n') + f.push(MARKER) + f.flush();
    expect(out).toBe("Yanıt. ");
  });

  it("drops a truncated FOLLOWUP at flush", () => {
    const f = createTaskMarkerFilter();
    const out = f.push('Yanıt. <<FOLLOWUP["yar') + f.flush();
    expect(out).toBe("Yanıt. ");
  });
});

describe("extractFollowUps", () => {
  it("parses and strips a trailing marker", () => {
    const { text, followUps } = extractFollowUps('Yanıt.\n<<FOLLOWUP["Soru bir?","Soru iki?"]>>');
    expect(text).toBe("Yanıt.");
    expect(followUps).toEqual(["Soru bir?", "Soru iki?"]);
  });

  it("returns text untouched when there is no marker", () => {
    const { text, followUps } = extractFollowUps("Sade bir yanıt.");
    expect(text).toBe("Sade bir yanıt.");
    expect(followUps).toEqual([]);
  });

  it("strips the marker but suggests nothing on broken JSON", () => {
    const { text, followUps } = extractFollowUps("Yanıt. <<FOLLOWUP[bozuk]>>");
    expect(text).toBe("Yanıt.");
    expect(followUps).toEqual([]);
  });

  it("caps at 3 items, trims, drops empties and non-strings", () => {
    const { followUps } = extractFollowUps(
      'Y. <<FOLLOWUP["  a  ","","b",42,"c","d"]>>',
    );
    expect(followUps).toEqual(["a", "b", "c"]);
  });

  it("works together with the trailing TASK marker (TASK stripped first)", () => {
    const stepOne = extractSuggestedTask(`Yanıt. <<FOLLOWUP["Soru?"]>>\n${MARKER}`);
    expect(stepOne.task).not.toBeNull();
    const stepTwo = extractFollowUps(stepOne.text);
    expect(stepTwo.text).toBe("Yanıt.");
    expect(stepTwo.followUps).toEqual(["Soru?"]);
  });
});

describe("extractReplyMarkers", () => {
  it("extracts and strips a structured memory candidate in any marker order", () => {
    const memory =
      '<<MEMORY{"key":"STUDY_TIME","value":"EVENING","sourceQuote":"Akşamları daha iyi çalışıyorum"}>>';
    const out = extractReplyMarkers(
      `Bunu ritmine ekleyebiliriz. ${MARKER}\n${memory}\n<<FOLLOWUP["Nasıl başlayayım?"]>>`,
    );
    expect(out.text).toBe("Bunu ritmine ekleyebiliriz.");
    expect(out.memoryCandidate).toEqual({
      key: "STUDY_TIME",
      value: "EVENING",
      sourceQuote: "Akşamları daha iyi çalışıyorum",
    });
    expect(out.text).not.toContain("<<MEMORY");
  });

  it("extracts both markers in the contract order (FOLLOWUP then TASK)", () => {
    const out = extractReplyMarkers(`Yanıt. <<FOLLOWUP["Soru?"]>>\n${MARKER}`);
    expect(out.text).toBe("Yanıt.");
    expect(out.task).toEqual({ title: "Matematik: 20 soru çöz", subject: "Matematik" });
    expect(out.followUps).toEqual(["Soru?"]);
  });

  it("extracts both markers when the model REVERSES the order (live gpt-4o-mini bug)", () => {
    const out = extractReplyMarkers(`Yanıt. ${MARKER}\n<<FOLLOWUP["Soru?"]>>`);
    expect(out.text).toBe("Yanıt.");
    expect(out.task).toEqual({ title: "Matematik: 20 soru çöz", subject: "Matematik" });
    expect(out.followUps).toEqual(["Soru?"]);
    expect(out.text).not.toContain("<<");
  });

  it("never leaks a MALFORMED marker (missing `>>` — seen live)", () => {
    const out = extractReplyMarkers('Yanıt.\n\n<<FOLLOWUP["Soru bir?","Soru iki?"]]');
    expect(out.text).toBe("Yanıt.");
    expect(out.text).not.toContain("<<");
    expect(out.followUps).toEqual([]); // unparseable — dropped, not guessed
  });

  it("never leaks a malformed TASK missing >> (session reflection, live)", () => {
    const out = extractReplyMarkers(
      'Tebrikler!\n<<TASK{"title":"mola teknikleri","subject":""}}',
    );
    expect(out.text).toBe("Tebrikler!");
    expect(out.text).not.toContain("<<TASK");
    expect(out.task).toEqual({ title: "mola teknikleri", subject: null });
  });

  it("handles a single marker and plain text", () => {
    expect(extractReplyMarkers("Sade yanıt.")).toEqual({
      text: "Sade yanıt.",
      task: null,
      followUps: [],
    });
    const only = extractReplyMarkers(`Yanıt. ${MARKER}`);
    expect(only.task).not.toBeNull();
    expect(only.followUps).toEqual([]);
  });

  it("holds a split memory marker out of streaming deltas", () => {
    const filter = createTaskMarkerFilter();
    const visible =
      filter.push("Yanıt. <<MEM") +
      filter.push('ORY{"key":"STUDY_TIME","value":"EVENING","sourceQuote":"x"}>>') +
      filter.flush();
    expect(visible).toBe("Yanıt. ");
  });
});
