import { CoachEvidenceType } from "@mentor/types";
import { applyPlanAdaptationSchema, coachPlanAdaptationSchema, updateMeSchema } from "@mentor/validation";
import { describe, expect, it } from "vitest";
import {
  buildPlanAdaptationPrompt,
  parsePlanAdaptation,
  selectPlanEvidence,
  studyDatesFor,
  suggestPlanBrief,
} from "./plan-adaptation";

const TODAY = "2026-07-21";
const TASKS = [
  {
    ref: "T1",
    id: "task-1",
    taskDate: TODAY,
    title: "Matematik çöz",
    subject: "Matematik",
    status: "PENDING",
    sortOrder: 0,
  },
  {
    ref: "T2",
    id: "task-2",
    taskDate: "2026-07-22",
    title: "Paragraf çöz",
    subject: "Türkçe",
    status: "PENDING",
    sortOrder: 0,
  },
];

describe("plan minute and apply contracts", () => {
  it("accepts whole custom goals from 10 through 600 minutes", () => {
    for (const minutes of [10, 75, 120, 600]) {
      expect(updateMeSchema.safeParse({ dailyFocusGoalMinutes: minutes }).success).toBe(true);
    }
    for (const minutes of [9, 60.5, 601]) {
      expect(updateMeSchema.safeParse({ dailyFocusGoalMinutes: minutes }).success).toBe(false);
    }
  });

  it("accepts 24 preview changes but rejects 25", () => {
    const change = { kind: "ADD", title: "Tarih soru çöz", subject: "Tarih", topic: null, taskDate: TODAY };
    const planRevision = "a".repeat(64);
    expect(applyPlanAdaptationSchema.safeParse({ planRevision, changes: Array(24).fill(change) }).success).toBe(true);
    expect(applyPlanAdaptationSchema.safeParse({ planRevision, changes: Array(25).fill(change) }).success).toBe(false);
  });
});

describe("parsePlanAdaptation", () => {
  it("builds two verified 60-minute blocks for an empty 120-minute study day", () => {
    const result = parsePlanAdaptation(
      JSON.stringify({ changes: [] }),
      TODAY,
      "PLAN",
      [],
      [],
      {
        studyDates: [TODAY],
        minutesPerDay: 120,
        focusSubjects: ["Matematik"],
        topics: [
          { subjectName: "Matematik", slug: "sayisal-mantik", name: "Sayısal mantık" },
          { subjectName: "Matematik", slug: "problemler", name: "Problemler" },
        ],
      },
    );

    expect(result.kind).toBe("VALID");
    if (result.kind !== "VALID") return;
    expect(result.changes).toHaveLength(2);
    expect(result.changes).toEqual([
      expect.objectContaining({ kind: "ADD", taskDate: TODAY, subject: "Matematik", topic: "Sayısal mantık", durationMinutes: 60 }),
      expect.objectContaining({ kind: "ADD", taskDate: TODAY, subject: "Matematik", topic: "Problemler", durationMinutes: 60 }),
    ]);
  });
  it("covers four selected subjects with verified topics across four 120-minute days", () => {
    const dates = [TODAY, "2026-07-22", "2026-07-24", "2026-07-26"];
    const subjects = ["Matematik", "Vatandaşlık", "Güncel Bilgiler", "Coğrafya"];
    const result = parsePlanAdaptation(
      "not-json",
      TODAY,
      "PLAN",
      [],
      [],
      {
        studyDates: dates,
        minutesPerDay: 120,
        focusSubjects: subjects,
        topics: subjects.map((subject, index) => ({
          subjectName: subject,
          slug: `topic-${index}`,
          name: `Doğrulanmış konu ${index}`,
        })),
      },
      { evidence: [], weakSubjects: ["Vatandaşlık", "Güncel Bilgiler"], notebookReason: "Yanlış defterinde Doğrulanmış konu 0 tekrar ediyor." },
    );
    expect(result.kind).toBe("VALID");
    if (result.kind !== "VALID") return;
    expect(result.changes).toHaveLength(8);
    expect(new Set(result.changes.map((item) => item.subject))).toEqual(new Set(subjects));
    expect(result.changes.filter((item) => item.subject === "Matematik").length).toBeGreaterThan(1);
    expect(result.changes.filter((item) => item.subject === "Vatandaşlık").length).toBeGreaterThan(1);
    expect(result.changes.filter((item) => item.subject === "Güncel Bilgiler").length).toBeGreaterThan(1);
    for (const date of dates) {
      const day = result.changes.filter((item) => item.kind === "ADD" && item.taskDate === date);
      expect(day).toHaveLength(2);
      expect(day.every((item) => item.kind === "ADD" && item.durationMinutes === 60 && item.topic?.startsWith("Doğrulanmış konu"))).toBe(true);
    }
  });

  it("budgets 120 new minutes even on occupied days and rejects model topic inventions", () => {
    const existing = [
      { ...TASKS[0]!, taskDate: TODAY },
      { ...TASKS[1]!, taskDate: "2026-07-22" },
      { ...TASKS[1]!, id: "t3", taskDate: "2026-07-22", title: "İkinci" },
      { ...TASKS[1]!, id: "t4", taskDate: "2026-07-22", title: "Üçüncü" },
    ];
    const result = parsePlanAdaptation(
      JSON.stringify({ changes: [{ kind: "ADD", taskDate: TODAY, subject: "Matematik", topicSlug: "uydurma" }] }),
      TODAY,
      "PLAN",
      existing,
      existing,
      { studyDates: [TODAY, "2026-07-22"], minutesPerDay: 120, focusSubjects: ["Matematik"], topics: [{ subjectName: "Matematik", slug: "verified", name: "Problemler" }] },
    );
    expect(result.kind).toBe("VALID");
    if (result.kind !== "VALID") return;
    expect(result.changes).toHaveLength(4);
    for (const date of [TODAY, "2026-07-22"]) {
      const day = result.changes.filter((change) => change.kind === "ADD" && change.taskDate === date);
      expect(day).toHaveLength(2);
      expect(day.every((change) => change.kind === "ADD" && change.topic === "Problemler" && change.durationMinutes === 60)).toBe(true);
    }
  });

  it("uses three nearly equal tasks for 121–600 minutes and a subject action without taxonomy", () => {
    const result = parsePlanAdaptation('{"changes":[]}', TODAY, "PLAN", [], [], {
      studyDates: [TODAY], minutesPerDay: 121, focusSubjects: ["Tarih"], topics: [],
    });
    expect(result.kind).toBe("VALID");
    if (result.kind !== "VALID") return;
    expect(result.changes).toHaveLength(3);
    expect(result.changes.map((item) => item.kind === "ADD" ? item.durationMinutes : null)).toEqual([41, 40, 40]);
    expect(result.changes.every((item) => item.kind === "ADD" && item.topic === null && item.title.includes("Tarih:"))).toBe(true);
  });
  it("fills the reported four-day program with 480 new minutes despite existing tasks", () => {
    const dates = ["2026-09-30", "2026-10-02", "2026-10-04", "2026-10-06"];
    const subjects = ["Matematik", "Vatandaşlık", "Güncel Bilgiler"];
    const existing = dates.slice(0, 3).map((date, index) => ({ ...TASKS[0]!, id: `old-${index}`, taskDate: date }));
    const result = parsePlanAdaptation("invalid model output", dates[0]!, "PLAN", existing, existing, {
      studyDates: dates, minutesPerDay: 120, focusSubjects: subjects,
      topics: subjects.map((subject, index) => ({ subjectName: subject, slug: `verified-${index}`, name: `Konu ${index}` })),
    }, { evidence: [], weakSubjects: ["Vatandaşlık", "Güncel Bilgiler"], notebookReason: "Konu 0 (5)" });
    expect(result.kind).toBe("VALID");
    if (result.kind !== "VALID") return;
    expect(result.changes).toHaveLength(8);
    expect(result.changes.some((change) => change.title.includes("notlarına bakmadan"))).toBe(true);
    for (const date of dates) {
      const day = result.changes.filter((change) => change.kind === "ADD" && change.taskDate === date);
      expect(day).toHaveLength(2);
      expect(new Set(day.map((change) => change.subject)).size).toBe(2);
      expect(day.reduce((sum, change) => sum + (change.kind === "ADD" ? change.durationMinutes ?? 0 : 0), 0)).toBe(120);
    }
    expect(result.changes.filter((change) => change.subject === "Vatandaşlık").length).toBeGreaterThanOrEqual(2);
    expect(result.changes.filter((change) => change.subject === "Güncel Bilgiler").length).toBeGreaterThanOrEqual(2);
    expect(existing.map((task) => task.title)).toEqual(Array(3).fill("Matematik çöz"));
  });
  it("keeps the action on long topic titles and never invents mistake cards", () => {
    const topicName = "A".repeat(160);
    const result = parsePlanAdaptation(JSON.stringify({ changes: [{ kind: "ADD", subject: "Tarih", topicSlug: "long", activity: "NOTEBOOK", taskDate: TODAY }] }), TODAY, "PLAN", [], [], {
      studyDates: [TODAY], minutesPerDay: 600, focusSubjects: ["Tarih"], topics: [{ subjectName: "Tarih", slug: "long", name: topicName }],
    });
    expect(result.kind).toBe("VALID");
    if (result.kind !== "VALID") return;
    expect(result.changes).toHaveLength(3);
    expect(result.changes.every((change) => change.title.length <= 200 && !change.title.includes("kartlarını"))).toBe(true);
    expect(result.changes[0]?.title.endsWith("soru çöz ve yanlışlarını incele")).toBe(true);
  });
  it("distinguishes malformed output from a valid empty preview", () => {
    expect(parsePlanAdaptation("not-json", TODAY, "PLAN", TASKS)).toEqual({
      kind: "MALFORMED",
    });
    expect(parsePlanAdaptation('{"changes":[]}', TODAY, "PLAN", TASKS)).toEqual(
      {
        kind: "VALID",
        changes: [],
      },
    );
  });

  it("maps opaque refs to server-owned MOVE fields and accepts safe ADD changes", () => {
    const result = parsePlanAdaptation(
      JSON.stringify({
        changes: [
          { kind: "MOVE", taskRef: "T1", toDate: "2026-07-23" },
          {
            kind: "ADD",
            title: "Kısa tekrar",
            subject: "Tarih",
            taskDate: "2026-07-24",
          },
        ],
      }),
      TODAY,
      "PLAN",
      TASKS,
    );

    expect(result).toEqual({
      kind: "VALID",
      changes: [
        {
          kind: "MOVE",
          taskId: "task-1",
          title: "Matematik çöz",
          subject: "Matematik",
          fromDate: TODAY,
          toDate: "2026-07-23",
        },
        {
          kind: "ADD",
          title: "Kısa tekrar",
          subject: "Tarih",
          taskDate: "2026-07-24",
        },
      ],
    });
  });

  it("filters unknown refs, same-day/out-of-window moves, duplicate moves and duplicate adds", () => {
    const result = parsePlanAdaptation(
      JSON.stringify({
        changes: [
          { kind: "MOVE", taskRef: "missing", toDate: "2026-07-23" },
          { kind: "MOVE", taskRef: "T1", toDate: TODAY },
          { kind: "MOVE", taskRef: "T2", toDate: "2026-08-01" },
          { kind: "MOVE", taskRef: "T1", toDate: "2026-07-23" },
          { kind: "MOVE", taskRef: "T1", toDate: "2026-07-24" },
          {
            kind: "ADD",
            title: "Paragraf çöz",
            subject: "Türkçe",
            taskDate: "2026-07-22",
          },
          {
            kind: "ADD",
            title: "Yeni görev",
            subject: null,
            taskDate: "2026-07-23",
          },
          {
            kind: "ADD",
            title: " yeni   GÖREV ",
            subject: "Başka",
            taskDate: "2026-07-23",
          },
        ],
      }),
      TODAY,
      "PLAN",
      TASKS,
    );

    expect(result.kind).toBe("VALID");
    if (result.kind === "VALID") {
      expect(result.changes).toHaveLength(2);
      expect(result.changes.map((change) => change.kind)).toEqual([
        "MOVE",
        "ADD",
      ]);
    }
  });

  it("enforces mood scope and forbids additions", () => {
    const result = parsePlanAdaptation(
      JSON.stringify({
        changes: [
          { kind: "MOVE", taskRef: "T2", toDate: "2026-07-24" },
          { kind: "MOVE", taskRef: "T1", toDate: "2026-07-22" },
          { kind: "ADD", title: "Yeni görev", taskDate: "2026-07-23" },
        ],
      }),
      TODAY,
      "MOOD",
      TASKS,
    );

    expect(result).toMatchObject({
      kind: "VALID",
      changes: [{ kind: "MOVE", taskId: "task-1", toDate: "2026-07-22" }],
    });
  });

  it("enforces target-day capacity after outbound moves", () => {
    const crowded = [
      ...TASKS,
      { ...TASKS[1]!, ref: "T3", id: "task-3", title: "Tarih" },
      { ...TASKS[1]!, ref: "T4", id: "task-4", title: "Coğrafya" },
    ];
    const result = parsePlanAdaptation(
      JSON.stringify({
        changes: [
          { kind: "MOVE", taskRef: "T2", toDate: "2026-07-23" },
          { kind: "MOVE", taskRef: "T1", toDate: "2026-07-22" },
          { kind: "ADD", title: "Fazla görev", taskDate: "2026-07-22" },
        ],
      }),
      TODAY,
      "PLAN",
      crowded,
    );

    expect(result).toMatchObject({
      kind: "VALID",
      changes: [
        { kind: "MOVE", taskId: "task-2", toDate: "2026-07-23" },
        { kind: "MOVE", taskId: "task-1", toDate: "2026-07-22" },
      ],
    });
  });

  it("rejects malformed dates and MOVE title collisions", () => {
    const tasks = [
      ...TASKS,
      {
        ...TASKS[1]!,
        ref: "T3",
        id: "task-3",
        title: " matematik ÇÖZ ",
      },
    ];
    const result = parsePlanAdaptation(
      JSON.stringify({
        changes: [
          { kind: "MOVE", taskRef: "T1", toDate: "2026-07-22" },
          {
            kind: "ADD",
            title: "Geçersiz tarih",
            taskDate: "2026-07-23junk",
          },
        ],
      }),
      TODAY,
      "PLAN",
      tasks,
    );

    expect(result).toEqual({ kind: "VALID", changes: [] });
  });

  it("uses the complete snapshot for capacity when prompt tasks are capped", () => {
    const capacityTasks = [
      ...TASKS,
      {
        ...TASKS[1]!,
        id: "hidden-1",
        title: "Tarih",
      },
      {
        ...TASKS[1]!,
        id: "hidden-2",
        title: "Coğrafya",
      },
    ];
    const result = parsePlanAdaptation(
      JSON.stringify({
        changes: [{ kind: "MOVE", taskRef: "T1", toDate: "2026-07-22" }],
      }),
      TODAY,
      "PLAN",
      [TASKS[0]!],
      capacityTasks,
    );

    expect(result).toEqual({ kind: "VALID", changes: [] });
  });

  it("drops a move chain when its capacity dependency is rejected", () => {
    const tasks = [
      ...TASKS,
      { ...TASKS[1]!, ref: "T3", id: "b-2", title: "B2" },
      { ...TASKS[1]!, ref: "T4", id: "b-3", title: "B3" },
      {
        ...TASKS[1]!,
        ref: "T5",
        id: "c-1",
        taskDate: "2026-07-23",
        title: "C1",
      },
      {
        ...TASKS[1]!,
        ref: "T6",
        id: "c-2",
        taskDate: "2026-07-23",
        title: "C2",
      },
      {
        ...TASKS[1]!,
        ref: "T7",
        id: "c-3",
        taskDate: "2026-07-23",
        title: "C3",
      },
    ];
    const result = parsePlanAdaptation(
      JSON.stringify({
        changes: [
          { kind: "MOVE", taskRef: "T1", toDate: "2026-07-22" },
          { kind: "MOVE", taskRef: "T2", toDate: "2026-07-23" },
        ],
      }),
      TODAY,
      "PLAN",
      tasks,
    );

    expect(result).toEqual({ kind: "VALID", changes: [] });
  });

  it("limits SESSION to two moves and one later ADD", () => {
    const many = [
      ...TASKS,
      { ...TASKS[0]!, ref: "T3", id: "task-3", title: "Tarih" },
    ];
    const result = parsePlanAdaptation(
      JSON.stringify({
        changes: [
          { kind: "MOVE", taskRef: "T1", toDate: "2026-07-22" },
          { kind: "MOVE", taskRef: "T2", toDate: "2026-07-23" },
          { kind: "MOVE", taskRef: "T3", toDate: "2026-07-24" },
          { kind: "ADD", title: "Bugün tekrar", taskDate: TODAY },
          { kind: "ADD", title: "Küçük tekrar", taskDate: "2026-07-25" },
          { kind: "ADD", title: "İkinci tekrar", taskDate: "2026-07-26" },
        ],
      }),
      TODAY,
      "SESSION",
      many,
    );

    expect(result.kind).toBe("VALID");
    if (result.kind === "VALID") {
      expect(
        result.changes.filter((change) => change.kind === "MOVE"),
      ).toHaveLength(2);
      expect(result.changes.filter((change) => change.kind === "ADD")).toEqual([
        {
          kind: "ADD",
          title: "Küçük tekrar",
          subject: null,
          taskDate: "2026-07-25",
        },
      ]);
    }
  });

  it("keeps one ADD on each requested day and fills a missing subject", () => {
    const changes = [22, 23, 24, 25, 26, 27].map((day, index) => ({
      kind: "ADD",
      title: `Blok ${index + 1}`,
      subject: null,
      taskDate: `2026-07-${day}`,
    }));
    const result = parsePlanAdaptation(
      JSON.stringify({ changes }),
      TODAY,
      "PLAN",
      TASKS,
      TASKS,
      { days: 5, focusSubjects: ["Türkçe", "Matematik"] },
    );

    expect(result.kind).toBe("VALID");
    if (result.kind !== "VALID") return;
    const adds = result.changes.filter((change) => change.kind === "ADD");
    expect(adds.map((change) => change.taskDate)).toEqual([
      "2026-07-22",
      "2026-07-23",
      "2026-07-24",
      "2026-07-25",
      "2026-07-26",
    ]);
    expect(adds[0]).toMatchObject({ subject: "Türkçe" });
    expect(adds[1]).toMatchObject({ subject: "Matematik" });
  });

  it("fills the days the model left out", () => {
    const result = parsePlanAdaptation(
      JSON.stringify({
        changes: [
          { kind: "ADD", title: "Türkçe konu tekrar", taskDate: "2026-07-24" },
          { kind: "ADD", title: "Matematik soru çözümü", taskDate: "2026-07-25" },
          { kind: "ADD", title: "Tarih notları", taskDate: "2026-07-26" },
        ],
      }),
      TODAY,
      "PLAN",
      TASKS,
      TASKS,
      { days: 5, minutesPerDay: 60, focusSubjects: ["Türkçe", "Matematik"] },
    );

    expect(result.kind).toBe("VALID");
    if (result.kind !== "VALID") return;
    const adds = result.changes.filter((change) => change.kind === "ADD");
    expect([...new Set(adds.map((change) => change.taskDate))]).toEqual([
      "2026-07-23",
      "2026-07-24",
      "2026-07-25",
      "2026-07-26",
      "2026-07-27",
    ]);
    expect(adds[0]).toMatchObject({
      durationMinutes: 30,
      subject: "Türkçe",
    });
    expect(adds.every((change) => change.subject != null && !/\d+\s*dk/.test(change.title))).toBe(true);
    expect(adds).toHaveLength(10);
  });

  it("rewrites a model title whose subject was not selected", () => {
    const result = parsePlanAdaptation(
      JSON.stringify({
        changes: [
          {
            kind: "ADD",
            title: "Matematik çalışması",
            subject: "Matematik",
            taskDate: "2026-07-24",
          },
          { kind: "ADD", title: "Osmanlı kronolojisi", subject: "Tarih", taskDate: "2026-07-25" },
        ],
      }),
      TODAY,
      "PLAN",
      TASKS,
      TASKS,
      { days: 2, minutesPerDay: 30, focusSubjects: ["Tarih"] },
    );

    expect(result.kind).toBe("VALID");
    if (result.kind !== "VALID") return;
    expect(result.changes).toHaveLength(2);
    expect(result.changes.every(change => change.kind === "ADD" && change.subject === "Tarih" && change.durationMinutes === 30 && !/\d+\s*dk/.test(change.title))).toBe(true);
  });

  it("uses another activity for a colliding filler in the request language", () => {
    // Least-loaded days (23, 24) already hold the practice title; use a different activity.
    const task = (taskDate: string, title: string, index: number) => ({
      ref: `X${index}`,
      id: `x-${index}`,
      taskDate,
      title,
      subject: "History",
      status: "PENDING",
      sortOrder: 0,
    });
    const taken = [
      task("2026-07-23", "History: practice questions and review mistakes", 0),
      task("2026-07-24", "History: practice questions and review mistakes", 1),
      task(TODAY, "Extra", 2),
      task("2026-07-22", "Extra", 3),
      ...["2026-07-25", "2026-07-26", "2026-07-27"].flatMap((date, index) => [
        task(date, "Extra A", 10 + index * 2),
        task(date, "Extra B", 11 + index * 2),
      ]),
    ];
    const tasks = [...TASKS, ...taken];
    const result = parsePlanAdaptation(
      '{"changes":[]}',
      TODAY,
      "PLAN",
      tasks,
      tasks,
      { days: 2, minutesPerDay: 30, focusSubjects: ["History"], locale: "en" },
    );

    expect(result.kind).toBe("VALID");
    if (result.kind !== "VALID") return;
    expect(result.changes).toHaveLength(2);
    expect(result.changes.every((change) => change.kind === "ADD" && change.durationMinutes === 30 && change.title === "History: review")).toBe(true);
    expect([...new Set(result.changes.map((change) => change.kind === "ADD" && change.taskDate))]).toEqual(["2026-07-23", "2026-07-24"]);
  });

  it("tells the model to cover the selected day count", () => {
    const prompt = buildPlanAdaptationPrompt({
      source: "PLAN",
      todayIso: TODAY,
      examType: "KPSS",
      evidence: [],
      tasks: [],
      days: 5,
      minutesPerDay: 60,
      focusSubjects: ["Tarih"],
    });

    expect(prompt.system).toContain("Yalnız 5 farklı gün için ADD yaz");
    expect(prompt.system).not.toContain("3 ADD");
    expect(prompt.user).toContain("Bağlayıcı ritim: 5 farklı gün");
    expect(prompt.user).toContain("60 dakika");
    expect(prompt.user).toContain("Tarih");
  });

  it("rejects a study rhythm on MOOD", () => {
    expect(
      coachPlanAdaptationSchema.safeParse({ source: "MOOD", days: 5 }).success,
    ).toBe(false);
    expect(
      coachPlanAdaptationSchema.safeParse({
        source: "PLAN",
        days: 5,
        minutesPerDay: 60,
        focusSubjects: ["Tarih"],
      }).success,
    ).toBe(true);
  });

  // TODAY is a Tuesday: 22 = Wednesday, 24 = Friday.
  it("leaves the days the note keeps free empty, for the model and the filler alike", () => {
    const result = parsePlanAdaptation(
      JSON.stringify({
        offDates: ["2026-07-22", "2026-07-24", "2026-08-30"],
        changes: [
          { kind: "MOVE", taskRef: "T1", toDate: "2026-07-22" },
          { kind: "ADD", title: "Tarih tekrar", subject: "Tarih", taskDate: "2026-07-24" },
          { kind: "ADD", title: "Tarih soru", subject: "Tarih", taskDate: "2026-07-25" },
        ],
      }),
      TODAY,
      "PLAN",
      TASKS,
      TASKS,
      { days: 4, minutesPerDay: 60, focusSubjects: ["Tarih"] },
    );

    expect(result.kind).toBe("VALID");
    if (result.kind !== "VALID") return;
    expect(result.changes.some((change) => change.kind === "MOVE")).toBe(false);
    expect(
      [...new Set(result.changes.map((change) => change.kind === "ADD" && change.taskDate))],
    ).toEqual(["2026-07-23", "2026-07-25", "2026-07-26", "2026-07-27"]);
  });

  it("puts every block on the weekdays the student picked", () => {
    const result = parsePlanAdaptation(
      JSON.stringify({
        changes: [
          { kind: "ADD", title: "Tarih tekrar", subject: "Tarih", taskDate: TODAY },
          { kind: "ADD", title: "Tarih soru", subject: "Tarih", taskDate: "2026-07-22" },
        ],
      }),
      TODAY,
      "PLAN",
      TASKS,
      TASKS,
      {
        studyDates: studyDatesFor(TODAY, [3, 5, 1]),
        minutesPerDay: 45,
        focusSubjects: ["Tarih"],
      },
    );

    expect(result.kind).toBe("VALID");
    if (result.kind !== "VALID") return;
    expect(result.changes).toEqual([
      expect.objectContaining({ title: "Tarih: soru çöz ve yanlışlarını incele", durationMinutes: 45, taskDate: "2026-07-22" }),
      expect.objectContaining({ title: "Tarih: soru çöz ve yanlışlarını incele", durationMinutes: 45, taskDate: "2026-07-24" }),
      expect.objectContaining({ title: "Tarih: soru çöz ve yanlışlarını incele", durationMinutes: 45, taskDate: "2026-07-27" }),
    ]);
  });

  it("maps ISO weekdays onto the rolling window", () => {
    expect(studyDatesFor(TODAY, [3, 5])).toEqual(["2026-07-22", "2026-07-24"]);
    expect(studyDatesFor(TODAY, [2])).toEqual([TODAY]);
  });

  it("uses every subject the student picked, not just the first three", () => {
    const result = parsePlanAdaptation(
      '{"changes":[]}',
      TODAY,
      "PLAN",
      [],
      [],
      { days: 4, focusSubjects: ["Türkçe", "Matematik", "Tarih", "Coğrafya"] },
    );

    expect(result.kind).toBe("VALID");
    if (result.kind !== "VALID") return;
    expect(result.changes.map((change) => change.subject)).toContain("Coğrafya");
  });

  it("names each window day and asks the model to hand back the days the note keeps free", () => {
    const plan = buildPlanAdaptationPrompt({
      source: "PLAN",
      todayIso: TODAY,
      examType: "KPSS",
      evidence: [],
      tasks: [],
      note: "çarşamba ve cuma boş kalsın",
    });
    expect(plan.system).toContain("2026-07-22 Çarşamba");
    expect(plan.system).toContain("offDates");

    const picked = buildPlanAdaptationPrompt({
      source: "PLAN",
      todayIso: TODAY,
      examType: "KPSS",
      evidence: [],
      tasks: [],
      studyDates: ["2026-07-22", "2026-07-24"],
      locale: "en",
    });
    expect(picked.system).toContain("2026-07-22 Wednesday, 2026-07-24 Friday");
    expect(picked.system).not.toContain("Tam ");
  });

  it("takes picked weekdays, any subject count and a typed minute count", () => {
    const ok = (body: object) => coachPlanAdaptationSchema.safeParse({ source: "PLAN", ...body }).success;
    expect(ok({ studyWeekdays: [3, 5], minutesPerDay: 45, focusSubjects: ["A", "B", "C", "D", "E"] })).toBe(true);
    expect(ok({ studyWeekdays: [3, 3] })).toBe(false);
    expect(ok({ studyWeekdays: [8] })).toBe(false);
    expect(ok({ studyWeekdays: [3], days: 1 })).toBe(false);
    expect(ok({ minutesPerDay: 5 })).toBe(false);
    expect(ok({ minutesPerDay: 700 })).toBe(false);
    expect(
      coachPlanAdaptationSchema.safeParse({ source: "MOOD", studyWeekdays: [3] }).success,
    ).toBe(false);
  });
});

const WEAK = "Denemelerinde en çok desteğe ihtiyaç duyan dersler (ortalama net): Matematik (9,6), Fen Bilimleri (8,2).";
const TOPICS = "Yanlış defterinde en çok kart biriken konular: Problemler (5).";
const CHOSEN = "Bu hafta ağırlık vermek istediğin ders.";
const EVIDENCE = [
  { ref: "E1", type: CoachEvidenceType.WEAK_SUBJECTS, summary: WEAK },
  { ref: "E2", type: CoachEvidenceType.NOTEBOOK_TOPICS, summary: TOPICS },
];
const grounding = {
  evidence: EVIDENCE,
  weakSubjects: ["Matematik", "Fen Bilimleri"],
  weakReason: WEAK,
  chosenReason: CHOSEN,
};

describe("plan adaptation reasons", () => {
  it("turns the evidence ref the model picked into the verified reason", () => {
    const result = parsePlanAdaptation(
      JSON.stringify({
        changes: [
          { kind: "MOVE", taskRef: "T1", toDate: "2026-07-23", evidenceRef: "E1" },
          { kind: "ADD", title: "Problemler 10 soru", subject: "Matematik", taskDate: "2026-07-24", evidenceRef: "E2" },
        ],
      }),
      TODAY,
      "PLAN",
      TASKS,
      TASKS,
      undefined,
      grounding,
    );

    expect(result).toEqual({
      kind: "VALID",
      changes: [
        expect.objectContaining({ kind: "MOVE", taskId: "task-1", reason: WEAK }),
        expect.objectContaining({ kind: "ADD", title: "Problemler 10 soru", reason: TOPICS }),
      ],
    });
  });

  it("leaves the reason out when the model names an unknown ref or none", () => {
    const result = parsePlanAdaptation(
      JSON.stringify({
        changes: [
          { kind: "ADD", title: "Paragraf 20 soru", subject: "Türkçe", taskDate: "2026-07-24", evidenceRef: "E9" },
          { kind: "ADD", title: "Kısa tekrar", subject: null, taskDate: "2026-07-25" },
        ],
      }),
      TODAY,
      "PLAN",
      TASKS,
      TASKS,
      undefined,
      grounding,
    );

    expect(result.kind).toBe("VALID");
    if (result.kind !== "VALID") return;
    for (const change of result.changes) expect(change).not.toHaveProperty("reason");
  });

  it("fills missing study days with weak subjects when the student picked none", () => {
    const result = parsePlanAdaptation(
      '{"changes":[]}',
      TODAY,
      "PLAN",
      TASKS,
      TASKS,
      { days: 2, minutesPerDay: 30 },
      grounding,
    );

    expect(result.kind).toBe("VALID");
    if (result.kind !== "VALID") return;
    expect(result.changes).toEqual([
      expect.objectContaining({ durationMinutes: 30, subject: "Matematik", reason: WEAK }),
      expect.objectContaining({ durationMinutes: 30, subject: "Fen Bilimleri", reason: WEAK }),
    ]);
  });

  it("explains blocks that come from the student's own subject choice", () => {
    const result = parsePlanAdaptation(
      JSON.stringify({
        changes: [
          { kind: "ADD", title: "Matematik çalışması", subject: "Matematik", taskDate: "2026-07-24", evidenceRef: "E1" },
        ],
      }),
      TODAY,
      "PLAN",
      TASKS,
      TASKS,
      { days: 2, minutesPerDay: 30, focusSubjects: ["Tarih"] },
      grounding,
    );

    expect(result.kind).toBe("VALID");
    if (result.kind !== "VALID") return;
    expect(result.changes).toHaveLength(2);
    for (const change of result.changes) {
      expect(change).toMatchObject({ subject: "Tarih", reason: CHOSEN });
    }
  });
});

describe("selectPlanEvidence", () => {
  const all = Object.values(CoachEvidenceType).map((type) => ({
    type,
    summary: `${type} özeti`,
    observedAt: "2026-07-21T09:00:00.000Z",
  }));

  it("gives a plan request up to six items in its own priority order with refs", () => {
    const selected = selectPlanEvidence("PLAN", all);
    expect(selected.map((item) => item.type)).toEqual([
      CoachEvidenceType.EXAM_PHASE,
      CoachEvidenceType.WEAK_SUBJECTS,
      CoachEvidenceType.NOTEBOOK_TOPICS,
      CoachEvidenceType.LONG_TERM_RHYTHM,
      CoachEvidenceType.GOAL,
      CoachEvidenceType.PLAN_FOLLOW_THROUGH,
    ]);
    expect(selected.map((item) => item.ref)).toEqual(["E1", "E2", "E3", "E4", "E5", "E6"]);
  });

  it("keeps mood and session adaptations on a narrow context", () => {
    expect(selectPlanEvidence("MOOD", all).map((item) => item.type)).toEqual([
      CoachEvidenceType.MOOD,
      CoachEvidenceType.RECENT_RHYTHM,
      CoachEvidenceType.TODAY_PLAN,
    ]);
    expect(selectPlanEvidence("SESSION", all).map((item) => item.type)).toEqual([
      CoachEvidenceType.RECENT_RHYTHM,
      CoachEvidenceType.SUBJECT_BALANCE,
      CoachEvidenceType.MOOD,
    ]);
  });
});

describe("plan adaptation prompt grounding", () => {
  const base = {
    source: "PLAN" as const,
    todayIso: TODAY,
    examType: "KPSS",
    evidence: EVIDENCE,
    tasks: [],
  };

  it("lists verified evidence with refs and asks for one ref per change", () => {
    const prompt = buildPlanAdaptationPrompt(base);

    expect(prompt.user).toContain(`E1 | WEAK_SUBJECTS | ${WEAK}`);
    expect(prompt.user).toContain(`E2 | NOTEBOOK_TOPICS | ${TOPICS}`);
    expect(prompt.system).toContain('"evidenceRef":"E1"');
    expect(prompt.system).toContain("Tarih veya gün sayısı yazma");
  });

  it("turns the final stretch into review and practice without saying how many days are left", () => {
    const final = buildPlanAdaptationPrompt({ ...base, examPhase: "FINAL" });
    const far = buildPlanAdaptationPrompt({ ...base, examPhase: "FAR" });

    expect(final.system).toContain("Sınav son düzlükte");
    expect(far.system).not.toContain("Sınav son düzlükte");
  });

  it("adds consented memory and coaching preferences only when given", () => {
    const withMemory = buildPlanAdaptationPrompt({
      ...base,
      memories: [{ key: "STUDY_TIME", value: "EVENING" }],
      preferences: { support: "ACTION", directness: "DIRECT" },
    });
    const without = buildPlanAdaptationPrompt(base);

    expect(withMemory.user).toContain("STUDY_TIME=EVENING");
    expect(withMemory.user).toContain("destek=ACTION");
    expect(withMemory.user).toContain("direktlik=DIRECT");
    expect(without.user).not.toContain("STUDY_TIME");
    expect(without.user).not.toContain("destek=");
  });
});

describe("suggestPlanBrief", () => {
  const base = {
    activeDays28d: 10,
    averageSessionMinutes28d: 43,
    dailyFocusGoalMinutes: null,
    weakSubjects: ["Matematik", "Tarih"],
    focusSubject: "Matematik",
    weekdayActivity28d: [],
  };

  it("picks the weekdays studied on most, as many as the rhythm's day count", () => {
    const weekdayActivity28d = [
      { weekday: 1, activeDays: 4, focusMinutes: 200 },
      { weekday: 3, activeDays: 3, focusMinutes: 90 },
      { weekday: 5, activeDays: 3, focusMinutes: 60 },
      { weekday: 6, activeDays: 3, focusMinutes: 150 },
    ];
    // 13 active days is three a week: Monday, then minutes break the Wednesday/Friday/Saturday tie.
    expect(
      suggestPlanBrief({ ...base, activeDays28d: 13, weekdayActivity28d }).weekdays,
    ).toEqual([1, 3, 6]);
    // Too little history for a rhythm, and never a weekday the student did not study on.
    expect(
      suggestPlanBrief({ ...base, activeDays28d: 3, weekdayActivity28d }).weekdays,
    ).toBeNull();
    expect(
      suggestPlanBrief({
        ...base,
        activeDays28d: 4,
        weekdayActivity28d: [{ weekday: 2, activeDays: 4, focusMinutes: 100 }],
      }).weekdays,
    ).toEqual([2]);
  });

  it.each([
    [null, null],
    [3, null],
    [4, 3],
    [10, 3],
    [20, 5],
    [28, 7],
  ] as const)("suggests days from %s active days in 28 as %s", (activeDays28d, days) => {
    expect(suggestPlanBrief({ ...base, activeDays28d }).days).toBe(days);
  });

  it.each([
    [60, null, 60],
    [45, null, 45],
    [200, null, 200],
    [null, 43, 43],
    [null, 100, 100],
    [null, 0, null],
    [null, null, null],
  ] as const)(
    "preserves minutes (goal %s, average session %s) as %s",
    (dailyFocusGoalMinutes, averageSessionMinutes28d, minutes) => {
      expect(
        suggestPlanBrief({ ...base, dailyFocusGoalMinutes, averageSessionMinutes28d })
          .minutesPerDay,
      ).toBe(minutes);
    },
  );

  it("puts the analysis focus first and keeps at most three distinct subjects", () => {
    expect(
      suggestPlanBrief({ ...base, focusSubject: "Türkçe" }).focusSubjects,
    ).toEqual(["Türkçe", "Matematik", "Tarih"]);
    expect(suggestPlanBrief(base).focusSubjects).toEqual(["Matematik", "Tarih"]);
    expect(
      suggestPlanBrief({ ...base, focusSubject: null, weakSubjects: [] }).focusSubjects,
    ).toEqual([]);
  });
});
