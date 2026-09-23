import { describe, expect, it } from "vitest";
import en from "../../../i18n/locales/en/coaching.json";
import tr from "../../../i18n/locales/tr/coaching.json";

/** Every summary CoachEvidenceService can emit. Students read these in "Neye göre?". */
const KEYS = [
  "todayPlan",
  "todayPlanNoSubjects",
  "todayFocus",
  "todayFocusNoGoal",
  "recentRhythm",
  "recentRhythmNoTimeBand",
  "longTermRhythm",
  "streak",
  "mood",
  "mockPerformance",
  "mockPerformanceNoFocus",
  "weakSubjects",
  "weakSubject",
  "notebookTopics",
  "notebookTopicsDue",
  "subjectBalance",
  "subjectBalanceGap",
  "planFollowThrough",
  "examPhase.FAR",
  "examPhase.MID",
  "examPhase.FINAL",
  "goal",
  "actionOutcome",
] as const;

/** Internal vocabulary that leaked into student copy before (voice.md: no AI slop). */
const BANNED = [
  "—",
  "backend",
  "normaliz",
  "taksonomi",
  "taxonomy",
  "kaba ",
  "coarse",
  "sinyal",
  "signal",
];

function lookup(source: unknown, key: string): string | undefined {
  const value = key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      source,
    );
  return typeof value === "string" ? value : undefined;
}

const placeholders = (template: string) =>
  [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe("coach evidence locales", () => {
  it.each(KEYS)("has student-facing TR and EN copy for %s", (key) => {
    const trText = lookup(tr.coachEvidence, key);
    const enText = lookup(en.coachEvidence, key);

    expect(trText).toBeTypeOf("string");
    expect(enText).toBeTypeOf("string");
    expect(placeholders(trText!)).toEqual(placeholders(enText!));
    for (const text of [trText!, enText!]) {
      for (const word of BANNED) {
        expect(text.toLocaleLowerCase("tr-TR")).not.toContain(word);
      }
    }
  });

  it("keeps the exam phase free of dates and day counts beyond the bucket edges", () => {
    for (const phase of ["FAR", "MID", "FINAL"]) {
      for (const source of [tr.coachEvidence, en.coachEvidence]) {
        const text = lookup(source, `examPhase.${phase}`) ?? "";
        expect(text).not.toMatch(/\{/);
        for (const digits of text.match(/\d+/g) ?? []) {
          expect(["30", "90"]).toContain(digits);
        }
      }
    }
  });
});
