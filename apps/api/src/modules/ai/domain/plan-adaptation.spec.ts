import { describe, expect, it } from "vitest";
import { parsePlanAdaptation } from "./plan-adaptation";

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
});
