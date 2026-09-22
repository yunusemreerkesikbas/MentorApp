import { describe, expect, it } from "vitest";
import { scoresFromMockExam, withScore, type SubjectScores } from "./analysis-types";

const empty: SubjectScores = { correct: "", wrong: "", blank: "", blankManual: false };

function typeInto(
  row: SubjectScores,
  steps: Array<[keyof Omit<SubjectScores, "blankManual">, string]>,
  questionCount: number | null = 30,
): SubjectScores {
  return steps.reduce((next, [field, value]) => withScore(next, field, value, questionCount), row);
}

describe("withScore", () => {
  it("fills blank as questions − correct − wrong once both are in, and follows them", () => {
    expect(typeInto(empty, [["correct", "24"]]).blank).toBe("");
    expect(typeInto(empty, [["correct", "24"], ["wrong", "4"]])).toEqual({
      correct: "24",
      wrong: "4",
      blank: "2",
      blankManual: false,
    });
    expect(typeInto(empty, [["correct", "24"], ["wrong", "4"], ["wrong", "6"]]).blank).toBe("0");
  });

  it("leaves blank empty when correct and wrong already exceed the questions", () => {
    expect(typeInto(empty, [["correct", "20"], ["wrong", "9"]], 27).blank).toBe("");
  });

  it("stops following once the student types a blank, and follows again when it is emptied", () => {
    const typed = typeInto(empty, [["correct", "24"], ["wrong", "4"], ["blank", "1"], ["wrong", "2"]]);
    expect(typed).toEqual({ correct: "24", wrong: "2", blank: "1", blankManual: true });
    expect(typeInto(typed, [["blank", ""], ["wrong", "3"]])).toEqual({
      correct: "24",
      wrong: "3",
      blank: "3",
      blankManual: false,
    });
  });

  it("does nothing automatic for a subject without a question count", () => {
    expect(typeInto(empty, [["correct", "5"], ["wrong", "1"]], null).blank).toBe("");
  });

  it("keeps a saved exam's blanks as the student entered them", () => {
    const scores = scoresFromMockExam(
      [
        { slug: "tarih", name: "Tarih", questionCount: 27, sortOrder: 1 },
        { slug: "cografya", name: "Coğrafya", questionCount: 18, sortOrder: 2 },
      ],
      [{ subjectRef: "tarih", correct: 20, wrong: 5, blank: 2 }],
    );
    expect(scores.tarih!.blankManual).toBe(true);
    expect(scores.cografya!.blankManual).toBe(false);
    expect(withScore(scores.tarih!, "correct", "21", 27).blank).toBe("2");
  });
});
