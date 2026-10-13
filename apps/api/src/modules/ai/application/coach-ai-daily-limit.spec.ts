import { describe, expect, it, vi } from "vitest";
import { PremiumFeatureId } from "@mentor/types";
import { ErrorCode } from "../../../common/errors/error-code";
import { CohortBriefService } from "./cohort-brief.service";
import { MentorshipBriefService } from "./mentorship-brief.service";

const COACH = { id: "coach-1", roles: ["COACH"] };

/**
 * The coach AI surfaces a free coach may taste (`ai.features.mentorship.*.free_enabled`). When the
 * day's taste is used up, the refusal has to say so: "open on Premium" names a product a coach
 * cannot buy. The gate stops the call before anything is spent, so a throwing gate is enough here.
 */
function services() {
  const gate = { assertAllowed: vi.fn(async () => Promise.reject(new Error("refused"))) };
  const complete = vi.fn();
  const deps = [
    { complete } as never,
    { get: vi.fn(async () => true) } as never,
    { append: vi.fn() } as never,
    { assertWithinBudget: vi.fn() } as never,
    gate as never,
  ] as const;
  return { gate, complete, brief: new MentorshipBriefService(...deps), cohort: new CohortBriefService(...deps) };
}

describe("coach AI surfaces name the daily limit", () => {
  it("the student brief", async () => {
    const s = services();
    await expect(s.brief.generate({} as never, null, COACH, "tr")).rejects.toThrow("refused");
    expect(s.gate.assertAllowed).toHaveBeenCalledWith(
      COACH.id,
      COACH.roles,
      PremiumFeatureId.MENTORSHIP_BRIEF,
      ErrorCode.MENTORSHIP_AI_DAILY_LIMIT,
    );
    expect(s.complete).not.toHaveBeenCalled();
  });

  it("the cohort brief", async () => {
    const s = services();
    await expect(s.cohort.generate({} as never, COACH, "tr")).rejects.toThrow("refused");
    expect(s.gate.assertAllowed).toHaveBeenCalledWith(
      COACH.id,
      COACH.roles,
      PremiumFeatureId.MENTORSHIP_COHORT_BRIEF,
      ErrorCode.MENTORSHIP_AI_DAILY_LIMIT,
    );
    expect(s.complete).not.toHaveBeenCalled();
  });
});
