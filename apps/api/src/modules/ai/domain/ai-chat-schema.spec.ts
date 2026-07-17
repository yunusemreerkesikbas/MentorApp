import { describe, expect, it } from "vitest";
import { aiChatSchema } from "@mentor/validation";

const MOCK_EXAM_ID = "00000000-0000-4000-8000-0000000000e1";

describe("aiChatSchema mock-exam context", () => {
  it("keeps requests without context backward compatible", () => {
    expect(aiChatSchema.safeParse({ message: "Hello" }).success).toBe(true);
  });

  it("accepts and preserves a valid contextMockExamId", () => {
    const parsed = aiChatSchema.parse({
      message: "Review this exam",
      contextMockExamId: MOCK_EXAM_ID,
    });

    expect(parsed.contextMockExamId).toBe(MOCK_EXAM_ID);
  });

  it("rejects an invalid contextMockExamId", () => {
    expect(
      aiChatSchema.safeParse({
        message: "Review this exam",
        contextMockExamId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });
});
