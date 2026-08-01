// @ts-expect-error -- executed with apps/api's Vitest runner.
import { describe, expect, it } from "vitest";
import type { ForumCoachIntent } from "@mentor/types";
import {
  coachReturnHref,
  communityCoachPlanHref,
  communityReturnPlaceholderKey,
  communityTaskSourceLabelKey,
  communityTaskReturnHref,
  communityTaskSourceHref,
  communityCoachDraft,
  parseCommunityReturnContext,
  parseCommunityCoachAttribution,
  safeInternalReturnTo,
  shouldShowCommunityCompletionPrompt,
} from "./community-coach-bridge";

describe("community coach bridge drafts", () => {
  it.each([
    ["PLAN", "Planımı", "my plan"],
    ["NEXT_STEP", "küçük bir adım", "small step"],
    ["STUDY_METHOD", "Çalışma ritmime", "study rhythm"],
    ["STRATEGY", "stratejimi", "strategy"],
  ] as const)(
    "creates editable TR/EN drafts for %s",
    (intent: ForumCoachIntent, trText: string, enText: string) => {
    expect(communityCoachDraft(intent, "tr")).toContain(trText);
    expect(communityCoachDraft(intent, "en")).toContain(enText);
    },
  );
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
  ])("rejects external or ambiguous return targets", (value: string) => {
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
        conversationId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toEqual({
      intent: "STUDY_METHOD",
      zoneType: "QA",
      conversationId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it.each([
    { source: "other", intent: "PLAN", zoneType: "CHAT", conversationId: "11111111-1111-4111-8111-111111111111" },
    { source: "community_coach", intent: "FAKE", zoneType: "CHAT", conversationId: "11111111-1111-4111-8111-111111111111" },
    { source: "community_coach", intent: "PLAN", zoneType: "ANNOUNCEMENT", conversationId: "11111111-1111-4111-8111-111111111111" },
    { source: "community_coach", intent: "PLAN", zoneType: "CHAT", conversationId: "not-a-uuid" },
  ])(
    "rejects invalid or non-bridge attribution",
    (params: { source: string; intent: string; zoneType: string; conversationId: string }) => {
    expect(parseCommunityCoachAttribution(params)).toBeNull();
    },
  );
});

describe("community task return loop", () => {
  const baseOrigin = {
    type: "COMMUNITY_COACH" as const,
    conversationId: "11111111-1111-4111-8111-111111111111",
    threadId: "22222222-2222-4222-8222-222222222222",
    intent: "PLAN" as const,
  };

  it("builds the CHAT comment composer route without prefilled content", () => {
    expect(communityTaskReturnHref({ ...baseOrigin, zoneType: "CHAT" })).toEqual({
      pathname: "/community/message/[threadId]",
      params: { threadId: baseOrigin.threadId },
      query: { composer: "community-return", intent: "PLAN" },
    });
  });

  it("opens a pending task's source without activating the return composer", () => {
    expect(
      communityTaskSourceHref(
        { ...baseOrigin, zoneType: "CHAT" },
        "PENDING",
      ),
    ).toEqual({
      pathname: "/community/message/[threadId]",
      params: { threadId: baseOrigin.threadId },
    });
    expect(
      communityTaskSourceHref({ ...baseOrigin, zoneType: "CHAT" }, "DONE"),
    ).toEqual(communityTaskReturnHref({ ...baseOrigin, zoneType: "CHAT" }));
  });

  it("carries only structural conversation attribution into the plan route", () => {
    expect(
      communityCoachPlanHref(
        { title: "Bugün 20 soru", subject: "Türkçe" },
        {
          intent: "NEXT_STEP",
          zoneType: "CHAT",
          conversationId: baseOrigin.conversationId,
        },
      ),
    ).toEqual({
      pathname: "/plan",
      query: {
        add: "1",
        title: "Bugün 20 soru",
        subject: "Türkçe",
        source: "community_coach",
        communityIntent: "NEXT_STEP",
        communityZoneType: "CHAT",
        communityConversationId: baseOrigin.conversationId,
      },
    });
  });

  it("builds the QA answer composer route", () => {
    expect(communityTaskReturnHref({ ...baseOrigin, zoneType: "QA" }).pathname).toBe(
      "/community/question/[threadId]",
    );
  });

  it("shows the prompt only for a successful community PENDING to DONE transition", () => {
    const updated = { id: "task", status: "DONE" as const, origin: { ...baseOrigin, zoneType: "CHAT" as const } };
    expect(shouldShowCommunityCompletionPrompt("PENDING", updated)).toBe(true);
    expect(shouldShowCommunityCompletionPrompt("DONE", updated)).toBe(false);
    expect(shouldShowCommunityCompletionPrompt("PENDING", { ...updated, origin: null })).toBe(false);
    expect(shouldShowCommunityCompletionPrompt("PENDING", { ...updated, status: "PENDING" })).toBe(false);
  });

  it("accepts only a content-free community return context", () => {
    expect(
      parseCommunityReturnContext({
        composer: "community-return",
        intent: "STUDY_METHOD",
      }),
    ).toEqual({ intent: "STUDY_METHOD" });
    expect(
      parseCommunityReturnContext({ composer: "other", intent: "PLAN" }),
    ).toBeNull();
    expect(
      parseCommunityReturnContext({
        composer: "community-return",
        intent: "made-up",
      }),
    ).toBeNull();
  });

  it("maps every intent to a localized placeholder key", () => {
    expect(communityReturnPlaceholderKey("PLAN")).toBe(
      "community_return_placeholder_plan",
    );
    expect(communityReturnPlaceholderKey("NEXT_STEP")).toBe(
      "community_return_placeholder_next_step",
    );
    expect(communityReturnPlaceholderKey("STUDY_METHOD")).toBe(
      "community_return_placeholder_study_method",
    );
    expect(communityReturnPlaceholderKey("STRATEGY")).toBe(
      "community_return_placeholder_strategy",
    );
  });

  it("keeps the community source marker across pending and done states", () => {
    expect(communityTaskSourceLabelKey("PENDING")).toBe(
      "community_task_source_pending",
    );
    expect(communityTaskSourceLabelKey("DONE")).toBe(
      "community_task_source_done",
    );
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
