import { describe, expect, it } from "vitest";
import type { MentorshipRosterRowDto } from "@mentor/types";
import {
  buildCohortBriefEvidence,
  buildCohortBriefPrompt,
  cohortBriefFingerprint,
  COHORT_BRIEF_JSON_SENTINEL,
  COHORT_BRIEF_MAX_STUDENTS,
  COHORT_BRIEF_PROMPT_VERSION,
  parseCohortBrief,
  selectCohortBriefRows,
} from "./cohort-brief-prompt";

const TODAY = "2026-09-07";

function row(over: Partial<MentorshipRosterRowDto> = {}): MentorshipRosterRowDto {
  return {
    linkId: "link",
    studentId: "student",
    studentDisplayName: "Ayşe",
    studentUsername: "ayse",
    status: "ACTIVE",
    acceptedAt: "2026-08-01T00:00:00.000Z",
    endedAt: null,
    metrics: {
      lastActiveDate: "2026-09-03",
      currentStreak: 0,
      focusMinutes7d: 40,
      sessions7d: 1,
      activeDays7d: 1,
      planCompletionRate7d: 0.2,
      latestMockNet: 42,
      latestMockAt: "2026-09-01T00:00:00.000Z",
      moodLevel7dAvg: 2,
    },
    riskFlags: ["INACTIVE"],
    attendedAt: null,
    needsAttention: true,
    ...over,
  } as MentorshipRosterRowDto;
}

describe("selectCohortBriefRows", () => {
  it("keeps only rows that need attention", () => {
    const rows = [
      row({ studentId: "a" }),
      row({ studentId: "b", needsAttention: false }),
    ];
    expect(selectCohortBriefRows(rows).map((r) => r.studentId)).toEqual(["a"]);
  });

  it("drops a row with no metrics even when it claims to need attention", () => {
    // An ENDED link carries no metrics; nothing about it may reach a prompt.
    const rows = [row({ studentId: "a", metrics: null, needsAttention: true })];
    expect(selectCohortBriefRows(rows)).toHaveLength(0);
  });

  it("caps the list, keeping the rows the caller ranked first", () => {
    const rows = Array.from({ length: COHORT_BRIEF_MAX_STUDENTS + 3 }, (_, i) =>
      row({ studentId: `s${i}` }),
    );
    const selected = selectCohortBriefRows(rows);
    expect(selected).toHaveLength(COHORT_BRIEF_MAX_STUDENTS);
    expect(selected[0]!.studentId).toBe("s0");
  });
});

describe("buildCohortBriefEvidence", () => {
  it("sends no name and no id, only a ref", () => {
    const evidence = buildCohortBriefEvidence(
      [row({ studentId: "3f9a-uuid-like", studentDisplayName: "Ayşe" })],
      TODAY,
    );
    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toContain("Ayşe");
    expect(serialized).not.toContain("3f9a-uuid-like");
    expect(evidence.students[0]!.ref).toBe("S1");
  });

  it("counts the whole roster but only lists the ones needing attention", () => {
    const evidence = buildCohortBriefEvidence(
      [row({ studentId: "a" }), row({ studentId: "b", needsAttention: false })],
      TODAY,
    );
    expect(evidence.activeStudents).toBe(2);
    expect(evidence.needingAttention).toBe(1);
    expect(evidence.students).toHaveLength(1);
  });

  it("turns the activity date into whole days, and never-active into null", () => {
    const active = buildCohortBriefEvidence([row()], TODAY);
    expect(active.students[0]!.daysSinceActive).toBe(4);
    const never = buildCohortBriefEvidence(
      [row({ metrics: { ...row().metrics!, lastActiveDate: null } })],
      TODAY,
    );
    expect(never.students[0]!.daysSinceActive).toBeNull();
  });
});

describe("cohortBriefFingerprint", () => {
  it("is stable for the same cohort and moves when it changes", () => {
    const a = buildCohortBriefEvidence([row()], TODAY);
    const b = buildCohortBriefEvidence([row()], TODAY);
    expect(cohortBriefFingerprint(a, "tr")).toBe(cohortBriefFingerprint(b, "tr"));

    const moved = buildCohortBriefEvidence(
      [row({ metrics: { ...row().metrics!, sessions7d: 9 } })],
      TODAY,
    );
    expect(cohortBriefFingerprint(moved, "tr")).not.toBe(cohortBriefFingerprint(a, "tr"));
  });

  it("separates locales", () => {
    const evidence = buildCohortBriefEvidence([row()], TODAY);
    expect(cohortBriefFingerprint(evidence, "tr")).not.toBe(
      cohortBriefFingerprint(evidence, "en"),
    );
  });

  it("is pinned to a prompt version, so a bump invalidates every stored brief", () => {
    // Deliberate assertion: changing the prompt without bumping this would serve stale text.
    expect(COHORT_BRIEF_PROMPT_VERSION).toBe("v1");
  });
});

describe("buildCohortBriefPrompt", () => {
  const evidence = buildCohortBriefEvidence([row()], TODAY);

  it("carries the sentinel the fake adapter and the parser both key on", () => {
    expect(buildCohortBriefPrompt(evidence, "tr").system).toContain(
      COHORT_BRIEF_JSON_SENTINEL,
    );
  });

  it("forbids comparing students in both locales", () => {
    expect(buildCohortBriefPrompt(evidence, "tr").system).toContain("KIYASLAMA");
    expect(buildCohortBriefPrompt(evidence, "en").system).toContain(
      "Do NOT compare students",
    );
  });

  it("forbids official information in both locales", () => {
    expect(buildCohortBriefPrompt(evidence, "tr").system).toContain("resmi bilgi");
    expect(buildCohortBriefPrompt(evidence, "en").system).toContain(
      "official information",
    );
  });
});

describe("parseCohortBrief", () => {
  const evidence = buildCohortBriefEvidence(
    [row({ studentId: "a" }), row({ studentId: "b" })],
    TODAY,
  );
  const ok = (items: unknown) => JSON.stringify({ overall: "Özet.", items });

  it("accepts a clean answer", () => {
    const result = parseCohortBrief(
      ok([{ ref: "S1", why: "Dört gündür girmedi.", action: "Bir mesaj at." }]),
      evidence,
    );
    expect(result).toEqual({
      kind: "VALID",
      overall: "Özet.",
      items: [{ ref: "S1", why: "Dört gündür girmedi.", action: "Bir mesaj at." }],
    });
  });

  it("tolerates fences and prose around the object", () => {
    const wrapped = "```json\n" + ok([{ ref: "S1", why: "a", action: "b" }]) + "\n```";
    expect(parseCohortBrief(wrapped, evidence).kind).toBe("VALID");
  });

  it("drops an invented ref instead of rendering it", () => {
    // The failure this guards: a sentence shown under a student it was never about.
    const result = parseCohortBrief(
      ok([
        { ref: "S9", why: "a", action: "b" },
        { ref: "S2", why: "c", action: "d" },
      ]),
      evidence,
    );
    expect(result.kind === "VALID" && result.items.map((i) => i.ref)).toEqual(["S2"]);
  });

  it("drops a duplicated ref", () => {
    const result = parseCohortBrief(
      ok([
        { ref: "S1", why: "a", action: "b" },
        { ref: "S1", why: "c", action: "d" },
      ]),
      evidence,
    );
    expect(result.kind === "VALID" && result.items).toHaveLength(1);
  });

  it("drops an item missing why or action", () => {
    const result = parseCohortBrief(
      ok([
        { ref: "S1", why: "a" },
        { ref: "S2", why: "  ", action: "d" },
      ]),
      evidence,
    );
    expect(result.kind === "VALID" && result.items).toHaveLength(0);
  });

  it("never returns more items than there are students", () => {
    const single = buildCohortBriefEvidence([row({ studentId: "a" })], TODAY);
    const result = parseCohortBrief(
      ok([
        { ref: "S1", why: "a", action: "b" },
        { ref: "S1", why: "c", action: "d" },
      ]),
      single,
    );
    expect(result.kind === "VALID" && result.items).toHaveLength(1);
  });

  it("strips a ref the model wrote into the prose", () => {
    // Measured against the real model: gpt-4o-mini produced "S1'in aktiflik durumu dikkat çekiyor"
    // on the first live call, so the prompt rule alone is not enough. The name is the line's
    // heading; the sentence drops the subject rather than trying to decline a Turkish suffix.
    const result = parseCohortBrief(
      JSON.stringify({
        overall: "S1'in aktiflik durumu dikkat çekiyor.",
        items: [
          {
            ref: "S1",
            why: "S1, son yedi günde hiç oturum açmadı.",
            action: "S1'e kısa bir mesaj at.",
          },
        ],
      }),
      evidence,
    );
    expect(result.kind === "VALID" && result.overall).toBe(
      "Aktiflik durumu dikkat çekiyor.",
    );
    expect(result.kind === "VALID" && result.items[0]!.why).toBe(
      "Son yedi günde hiç oturum açmadı.",
    );
    expect(result.kind === "VALID" && result.items[0]!.action).toBe(
      "Kısa bir mesaj at.",
    );
  });

  it("leaves ordinary text alone", () => {
    const result = parseCohortBrief(
      JSON.stringify({
        overall: "Bir öğrenci bekliyor.",
        items: [{ ref: "S1", why: "Sınav netleri düştü.", action: "Deneme analizine bak." }],
      }),
      evidence,
    );
    expect(result.kind === "VALID" && result.items[0]!.why).toBe("Sınav netleri düştü.");
  });

  it("reports malformed JSON distinctly from an empty list", () => {
    expect(parseCohortBrief("not json at all", evidence).kind).toBe("MALFORMED");
    expect(parseCohortBrief('{"overall":"x"}', evidence).kind).toBe("MALFORMED");
    expect(parseCohortBrief(ok([]), evidence)).toEqual({
      kind: "VALID",
      overall: "Özet.",
      items: [],
    });
  });
});
