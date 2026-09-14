import { describe, expect, it } from "vitest";
import type { MentorshipWeeklySnapshotDto } from "@mentor/types";
import {
  buildMentorshipWeeklyBriefPrompt,
  parseMentorshipWeeklyBrief,
} from "./mentorship-weekly-brief-prompt";

const snapshot = {
  evidence: [
    {
      id: "focus_minutes",
      kind: "FOCUS_MINUTES",
      current: 120,
      previous: 80,
      delta: 40,
    },
    {
      id: "completion_rate",
      kind: "COMPLETION_RATE",
      current: 0.5,
      previous: 0.75,
      delta: -0.25,
    },
  ],
  limitations: ["NO_CURRENT_MOCK"],
} as MentorshipWeeklySnapshotDto;

describe("mentorship weekly brief prompt", () => {
  it("sends only deterministic evidence and limitations", () => {
    const prompt = buildMentorshipWeeklyBriefPrompt(snapshot, "tr");
    expect(JSON.parse(prompt.user)).toEqual({
      evidence: snapshot.evidence,
      limitations: ["NO_CURRENT_MOCK"],
    });
    expect(prompt.user).not.toContain("student");
  });

  it("drops findings that cite unknown evidence", () => {
    const result = parseMentorshipWeeklyBrief(
      JSON.stringify({
        findings: [
          {
            observation: "Çalışma süresi arttı.",
            evidenceIds: ["focus_minutes"],
            uncertainty: "Süre öğrenme sonucunu tek başına göstermez.",
            conversationQuestion: "Bu çalışma düzeni sana nasıl geldi?",
          },
          {
            observation: "Bilinmeyen yorum.",
            evidenceIds: ["motivation_score"],
            uncertainty: "Yok.",
            conversationQuestion: "Neden?",
          },
        ],
      }),
      snapshot.evidence,
    );

    expect(result).toMatchObject({ kind: "VALID" });
    if (result.kind === "VALID") {
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]!.evidenceIds).toEqual(["focus_minutes"]);
    }
  });

  it("rejects prose or a payload without usable findings", () => {
    expect(
      parseMentorshipWeeklyBrief("bir değerlendirme", snapshot.evidence),
    ).toEqual({
      kind: "MALFORMED",
    });
    expect(
      parseMentorshipWeeklyBrief('{"findings":[]}', snapshot.evidence),
    ).toEqual({ kind: "MALFORMED" });
  });
});
