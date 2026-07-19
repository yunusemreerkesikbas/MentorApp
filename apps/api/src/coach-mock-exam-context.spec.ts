import { describe, expect, it } from "vitest";
import * as coach from "../../web/src/lib/coach";

const MOCK_EXAM_ID = "00000000-0000-4000-8000-0000000000e1";

describe("coach mock-exam context lifecycle", () => {
  it("keeps context pending after failure and consumes it only after success is recorded", () => {
    expect(coach.resolvePendingCoachContext(MOCK_EXAM_ID, null)).toBe(MOCK_EXAM_ID);
    expect(coach.resolvePendingCoachContext(MOCK_EXAM_ID, null)).toBe(MOCK_EXAM_ID);
    expect(coach.resolvePendingCoachContext(MOCK_EXAM_ID, MOCK_EXAM_ID)).toBeUndefined();
  });

  it("removes only contextMockExamId after success", () => {
    expect(
      coach.removeCoachContextFromUrl(
        `http://localhost:3000/koc/sohbet?seed=review&contextMockExamId=${MOCK_EXAM_ID}&c=thread#composer`,
      ),
    ).toBe("/koc/sohbet?seed=review&c=thread#composer");
  });

  it("builds a coach href with the selected mock exam", () => {
    const buildHref = (coach as unknown as Record<string, unknown>)
      .buildCoachMockExamHref;

    expect(buildHref).toBeTypeOf("function");
    expect(
      (buildHref as (seed: string, contextMockExamId: string) => unknown)(
        "Review this exam",
        MOCK_EXAM_ID,
      ),
    ).toEqual({
      pathname: "/coach/chat",
      query: {
        seed: "Review this exam",
        contextMockExamId: MOCK_EXAM_ID,
      },
    });
  });
});
