import { coachPlanAdaptationSchema } from "@mentor/validation";
import { describe, expect, it } from "vitest";
import {
  buildPlanAdaptationPrompt,
  parsePlanAdaptation,
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

describe("parsePlanAdaptation", () => {
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
    expect(adds.map((change) => change.taskDate)).toEqual([
      "2026-07-23",
      "2026-07-24",
      "2026-07-25",
      "2026-07-26",
      "2026-07-27",
    ]);
    expect(adds[0]).toMatchObject({
      title: "Türkçe · 60 dk",
      subject: "Türkçe",
    });
    expect(adds.every((change) => change.subject != null)).toBe(true);
  });

  it("tells the model to cover the selected day count", () => {
    const prompt = buildPlanAdaptationPrompt({
      source: "PLAN",
      todayIso: TODAY,
      examType: "KPSS",
      recentSummary: null,
      tasks: [],
      days: 5,
      minutesPerDay: 60,
      focusSubjects: ["Tarih"],
    });

    expect(prompt.system).toContain("Tam 5 farklı güne");
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
});
