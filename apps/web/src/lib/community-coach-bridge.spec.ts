// @ts-expect-error -- executed with apps/api's Vitest runner.
import { describe, expect, it } from "vitest";
import {
  coachReturnHref,
  communityCoachDraft,
  parseCommunityCoachAttribution,
  safeInternalReturnTo,
} from "./community-coach-bridge";

describe("community coach bridge drafts", () => {
  it.each([
    ["PLAN", "Planımı", "my plan"],
    ["NEXT_STEP", "küçük bir adım", "small step"],
    ["STUDY_METHOD", "Çalışma ritmime", "study rhythm"],
    ["STRATEGY", "stratejimi", "strategy"],
  ] as const)("creates editable TR/EN drafts for %s", (intent, trText, enText) => {
    expect(communityCoachDraft(intent, "tr")).toContain(trText);
    expect(communityCoachDraft(intent, "en")).toContain(enText);
  });
});

describe("safeInternalReturnTo", () => {
  it("keeps an internal coach context URL", () => {
    expect(
      safeInternalReturnTo(
        "/coach/chat?seed=Plan%C4%B1m%C4%B1&contextCommunityThreadId=11111111-1111-4111-8111-111111111111",
      ),
    ).toContain("/coach/chat?");
  });

  it.each([
    "https://evil.example/coach/chat",
    "//evil.example/coach/chat",
    "/\\evil.example/coach/chat",
    "javascript:alert(1)",
  ])("rejects external or ambiguous return targets", (value) => {
    expect(safeInternalReturnTo(value)).toBe("/coach/chat");
  });
});

describe("parseCommunityCoachAttribution", () => {
  it("accepts only the content-free enum metadata", () => {
    expect(
      parseCommunityCoachAttribution({
        source: "community_coach",
        intent: "STUDY_METHOD",
        zoneType: "QA",
      }),
    ).toEqual({ intent: "STUDY_METHOD", zoneType: "QA" });
  });

  it.each([
    { source: "other", intent: "PLAN", zoneType: "CHAT" },
    { source: "community_coach", intent: "FAKE", zoneType: "CHAT" },
    { source: "community_coach", intent: "PLAN", zoneType: "ANNOUNCEMENT" },
  ])("rejects invalid or non-bridge attribution", (params) => {
    expect(parseCommunityCoachAttribution(params)).toBeNull();
  });
});

describe("coachReturnHref", () => {
  it("keeps only known coach query fields on the typed chat route", () => {
    expect(
      coachReturnHref(
        "/coach/chat?seed=Merhaba&contextCommunityThreadId=11111111-1111-4111-8111-111111111111&unsafe=x",
      ),
    ).toEqual({
      pathname: "/coach/chat",
      query: {
        seed: "Merhaba",
        contextCommunityThreadId: "11111111-1111-4111-8111-111111111111",
      },
    });
  });

  it("falls back to the coach hub for external or unrelated routes", () => {
    expect(coachReturnHref("https://evil.example/coach/chat")).toEqual({ pathname: "/coach" });
    expect(coachReturnHref("/dashboard")).toEqual({ pathname: "/coach" });
  });
});
