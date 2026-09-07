import { describe, expect, it } from "vitest";
import {
  ASSIGNMENT_SUGGESTION_JSON_SENTINEL,
  buildAssignmentSuggestionPrompt,
  collectEvidenceSubjects,
  parseAssignmentSuggestions,
} from "./assignment-suggestion-prompt";
import type { MentorshipBriefEvidence } from "./mentorship-brief-prompt";

const EVIDENCE = {
  examType: "KPSS",
  riskFlags: ["INACTIVE"],
  activity: {
    lastActiveDate: "2026-09-01",
    currentStreak: 0,
    longestStreak: 4,
    sessions7d: 0,
    focusMinutes7d: 0,
    activeDays7d: 0,
    sessions28d: 3,
    focusMinutes28d: 90,
    activeDays28d: 3,
  },
  planCompletionRate7d: 0.2,
  mockTrend: [],
  latestMockSubjects: [],
  moodTrend: [],
  planTasks: [],
  droppedAssignments: [],
} as unknown as MentorshipBriefEvidence;

const wrap = (tasks: unknown) => JSON.stringify({ tasks });
/** What this student's own data names. Anything else is the model guessing at a syllabus. */
const SUBJECTS = new Set(["matematik", "türkçe"]);

describe("buildAssignmentSuggestionPrompt", () => {
  it("carries the sentinel the fake adapter keys on", () => {
    expect(buildAssignmentSuggestionPrompt(EVIDENCE, "tr").system).toContain(
      ASSIGNMENT_SUGGESTION_JSON_SENTINEL,
    );
  });

  it("tells the model there is no topic field, in both locales", () => {
    expect(buildAssignmentSuggestionPrompt(EVIDENCE, "tr").system).toContain("ALANI YOK");
    expect(buildAssignmentSuggestionPrompt(EVIDENCE, "en").system).toContain(
      "NO topic field",
    );
  });

  it("forbids dates and official information", () => {
    const tr = buildAssignmentSuggestionPrompt(EVIDENCE, "tr").system;
    expect(tr).toContain("Tarih YAZMA");
    expect(tr).toContain("resmi bilgi");
  });

  it("sends the shaped evidence and nothing else", () => {
    const { user } = buildAssignmentSuggestionPrompt(EVIDENCE, "tr");
    expect(JSON.parse(user)).toEqual(EVIDENCE);
  });
});

describe("parseAssignmentSuggestions", () => {
  it("accepts a clean week and sorts it by day", () => {
    const result = parseAssignmentSuggestions(
      wrap([
        { dayIndex: 3, title: "Matematik: 15 problem", subject: "Matematik", coachNote: null },
        { dayIndex: 0, title: "Paragraf: 20 soru", subject: "Türkçe", coachNote: "Süre tut." },
      ]),
      SUBJECTS,
    );
    expect(result).toEqual({
      kind: "VALID",
      tasks: [
        {
          dayIndex: 0,
          title: "Paragraf: 20 soru",
          subject: "Türkçe",
          topic: null,
          coachNote: "Süre tut.",
        },
        {
          dayIndex: 3,
          title: "Matematik: 15 problem",
          subject: "Matematik",
          topic: null,
          coachNote: null,
        },
      ],
    });
  });

  it("forces topic to null even when the model sends one", () => {
    // The composer's picker is the only thing that knows this student's exam taxonomy (APP-074).
    // A model-authored topic would ride onto a plan and read back as if someone had checked it.
    const result = parseAssignmentSuggestions(
      wrap([{ dayIndex: 0, title: "Soru çöz", subject: "Tarih", topic: "Kurtuluş Savaşı" }]),
      SUBJECTS,
    );
    expect(result.kind === "VALID" && result.tasks[0]!.topic).toBeNull();
  });

  it("drops a day outside the week rather than clamping it into one", () => {
    const result = parseAssignmentSuggestions(
      wrap([
        { dayIndex: 7, title: "Gelecek hafta" },
        { dayIndex: -1, title: "Geçmiş" },
        { dayIndex: 1.5, title: "Buçuk" },
        { dayIndex: 6, title: "Son gün" },
      ]),
      SUBJECTS,
    );
    expect(result.kind === "VALID" && result.tasks.map((t) => t.title)).toEqual(["Son gün"]);
  });

  it("holds a day to three tasks", () => {
    const result = parseAssignmentSuggestions(
      wrap(
        ["a", "b", "c", "d"].map((title) => ({ dayIndex: 2, title })),
      ),
      SUBJECTS,
    );
    expect(result.kind === "VALID" && result.tasks).toHaveLength(3);
  });

  it("caps the whole week at seven", () => {
    const result = parseAssignmentSuggestions(
      wrap(
        Array.from({ length: 12 }, (_, i) => ({
          dayIndex: i % 6,
          title: `Görev ${i}`,
        })),
      ),
      SUBJECTS,
    );
    expect(result.kind === "VALID" && result.tasks).toHaveLength(7);
  });

  it("drops a same-day duplicate title, case-insensitively", () => {
    const result = parseAssignmentSuggestions(
      wrap([
        { dayIndex: 0, title: "Paragraf: 20 soru" },
        { dayIndex: 0, title: "PARAGRAF: 20 SORU" },
        { dayIndex: 1, title: "Paragraf: 20 soru" },
      ]),
      SUBJECTS,
    );
    expect(result.kind === "VALID" && result.tasks).toHaveLength(2);
  });

  it("drops a task with no usable title", () => {
    const result = parseAssignmentSuggestions(
      wrap([{ dayIndex: 0, title: "   " }, { dayIndex: 0, title: 42 }]),
      SUBJECTS,
    );
    expect(result.kind === "VALID" && result.tasks).toHaveLength(0);
  });

  it("blanks a subject or note the model left empty", () => {
    const result = parseAssignmentSuggestions(
      wrap([{ dayIndex: 0, title: "Soru çöz", subject: "  ", coachNote: "" }]),
      SUBJECTS,
    );
    expect(result.kind === "VALID" && result.tasks[0]).toMatchObject({
      subject: null,
      coachNote: null,
    });
  });

  it("survives a null entry instead of throwing out of the parser", () => {
    // `null` is the one entry that does not merely fail the checks — it throws on property access,
    // and this loop is outside the try/catch that guards JSON.parse. Without the guard a model
    // answering `{"tasks":[null]}` turns a bad completion into a 500. (CodeRabbit, PR #87.)
    const result = parseAssignmentSuggestions(
      wrap([null, "metin", 42, [], { dayIndex: 0, title: "Soru çöz" }]),
      SUBJECTS,
    );
    expect(result.kind === "VALID" && result.tasks.map((t) => t.title)).toEqual(["Soru çöz"]);
  });

  it("tolerates fences, and reports malformed JSON distinctly from an empty week", () => {
    const fenced = "```json\n" + wrap([{ dayIndex: 0, title: "Soru çöz" }]) + "\n```";
    expect(parseAssignmentSuggestions(fenced, SUBJECTS).kind).toBe("VALID");
    expect(parseAssignmentSuggestions("hiç JSON yok", SUBJECTS).kind).toBe("MALFORMED");
    expect(parseAssignmentSuggestions('{"other":[]}', SUBJECTS).kind).toBe("MALFORMED");
    expect(parseAssignmentSuggestions(wrap([]), SUBJECTS)).toEqual({
      kind: "VALID",
      tasks: [],
    });
  });
});

describe("weekly variety", () => {
  it("caps one title at three across the week", () => {
    // Measured against the real model: a student with almost no data got "Paragraf: 10 soru çöz"
    // on all seven days. Told to propose fewer tasks when the evidence is thin, it repeated one
    // instead — the same emptiness wearing a full week's clothes.
    const result = parseAssignmentSuggestions(
      wrap(
        Array.from({ length: 7 }, (_, dayIndex) => ({
          dayIndex,
          title: "Paragraf: 10 soru çöz",
        })),
      ),
      SUBJECTS,
    );
    expect(result.kind === "VALID" && result.tasks).toHaveLength(3);
  });

  it("still allows a genuinely varied week to fill up", () => {
    const result = parseAssignmentSuggestions(
      wrap(
        Array.from({ length: 7 }, (_, dayIndex) => ({
          dayIndex,
          title: `Görev ${dayIndex}`,
        })),
      ),
      SUBJECTS,
    );
    expect(result.kind === "VALID" && result.tasks).toHaveLength(7);
  });
});

describe("subject grounding", () => {
  it("collects the subjects the student's own data names", () => {
    const subjects = collectEvidenceSubjects({
      ...EVIDENCE,
      latestMockSubjects: [{ subjectRef: "Matematik", net: 12, wrong: 3, blank: 1 }],
      planTasks: [{ taskDate: "2026-09-01", title: "x", subject: "Türkçe", status: "PENDING", assignedByCoach: false }],
    } as unknown as MentorshipBriefEvidence);
    expect(subjects).toEqual(new Set(["matematik", "türkçe"]));
  });

  it("blanks a subject the evidence never named, keeping the task", () => {
    // Measured against the real model: a KPSS candidate with no mock data was handed
    // "Fen Bilgisi: 5 deney yaz". The prompt asks for grounding; this is what enforces it.
    const result = parseAssignmentSuggestions(
      wrap([{ dayIndex: 0, title: "Fen Bilgisi: 5 deney yaz", subject: "Fen Bilgisi" }]),
      SUBJECTS,
    );
    expect(result.kind === "VALID" && result.tasks[0]).toMatchObject({
      title: "Fen Bilgisi: 5 deney yaz",
      subject: null,
    });
  });

  it("keeps a grounded subject whatever its casing", () => {
    const result = parseAssignmentSuggestions(
      wrap([{ dayIndex: 0, title: "Soru çöz", subject: "MATEMATİK" }]),
      SUBJECTS,
    );
    expect(result.kind === "VALID" && result.tasks[0]!.subject).toBe("MATEMATİK");
  });

  it("blanks every subject when the student has no data to ground on", () => {
    const result = parseAssignmentSuggestions(
      wrap([{ dayIndex: 0, title: "Soru çöz", subject: "Matematik" }]),
      new Set<string>(),
    );
    expect(result.kind === "VALID" && result.tasks[0]!.subject).toBeNull();
  });
});
