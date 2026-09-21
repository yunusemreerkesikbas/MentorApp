import { describe, expect, it, vi } from "vitest";
import type { MentorshipWeeklySnapshotDto } from "@mentor/types";
import { PremiumFeatureId } from "@mentor/types";
import { AiUsageFeature } from "../domain/ai.constants";
import { MentorshipWeeklyBriefWriterService } from "./mentorship-weekly-brief-writer.service";

describe("MentorshipWeeklyBriefWriterService", () => {
  it("returns validated structured findings from the privacy-safe evidence", async () => {
    const complete = vi.fn(async () => ({
      text: JSON.stringify({
        preparation: {
          version: 1,
          focus: {
            text: "Çalışma süresi arttı.",
            evidenceIds: ["focus_minutes"],
          },
          progress: null,
          uncertainty: "Süre tek başına öğrenmeyi göstermez.",
          question: "Bu düzen sana nasıl geldi?",
          nextStep: null,
        },
      }),
      model: "fake",
      promptTokens: 10,
      completionTokens: 20,
    }));
    const append = vi.fn();
    const assertAllowed = vi.fn();
    const service = new MentorshipWeeklyBriefWriterService(
      { complete } as never,
      { get: vi.fn(async () => true) } as never,
      { append } as never,
      { assertWithinBudget: vi.fn() } as never,
      { assertAllowed } as never,
    );
    const snapshot = {
      evidence: [
        {
          id: "focus_minutes",
          kind: "FOCUS_MINUTES",
          current: 120,
          previous: 80,
          delta: 40,
        },
      ],
      limitations: [],
    } as unknown as MentorshipWeeklySnapshotDto;

    const result = await service.generate(
      snapshot,
      { id: "coach", roles: ["COACH"] },
      "tr",
    );

    expect(result).toMatchObject({
      findings: [
        {
          observation: "Çalışma süresi arttı.",
          evidenceIds: ["focus_minutes"],
          uncertainty: "Süre tek başına öğrenmeyi göstermez.",
          conversationQuestion: "Bu düzen sana nasıl geldi?",
        },
      ],
      model: "fake",
    });
    expect(assertAllowed).toHaveBeenCalledWith(
      "coach",
      ["COACH"],
      PremiumFeatureId.MENTORSHIP_BRIEF,
    );
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "coach",
        feature: AiUsageFeature.MENTORSHIP_BRIEF,
      }),
    );
  });

  it("rejects a model response without valid evidence references, still recording its usage", async () => {
    const append = vi.fn();
    const service = new MentorshipWeeklyBriefWriterService(
      {
        complete: vi.fn(async () => ({
          text: '{"findings":[]}',
          model: "fake",
          promptTokens: 1,
          completionTokens: 1,
        })),
      } as never,
      { get: vi.fn(async () => true) } as never,
      { append } as never,
      { assertWithinBudget: vi.fn() } as never,
      { assertAllowed: vi.fn() } as never,
    );

    await expect(
      service.generate(
        {
          evidence: [],
          limitations: [],
        } as unknown as MentorshipWeeklySnapshotDto,
        { id: "coach", roles: ["COACH"] },
        "tr",
      ),
    ).rejects.toThrow("AI_MALFORMED_RESPONSE");
    expect(append).toHaveBeenCalledOnce();
  });
});
