import assert from "node:assert/strict";
import { it } from "node:test";
import { openCoachChat } from "./coach-chat-state.ts";

it("opens each linked deneme as its own draft with that deneme's context", () => {
  assert.deepEqual(openCoachChat({ seed: "Birinci deneme", contextMockExamId: "first" }), {
    draft: "Birinci deneme", conversationId: null, context: { contextMockExamId: "first" },
  });
  assert.deepEqual(openCoachChat({ seed: "İkinci deneme", contextMockExamId: "second" }), {
    draft: "İkinci deneme", conversationId: null, context: { contextMockExamId: "second" },
  });
});

it("clears the draft and context for new chats, selected threads, and successful replies", () => {
  assert.equal(openCoachChat().conversationId, undefined);
  assert.deepEqual(openCoachChat({}, null), { draft: "", conversationId: null, context: {} });
  assert.deepEqual(openCoachChat({}, "thread"), { draft: "", conversationId: "thread", context: {} });
});

it("keeps only supported context fields from the route", () => {
  const route = { contextArticleSlug: "exam-guide", conversationId: "untrusted", message: "untrusted" };
  assert.deepEqual(openCoachChat(route), {
    draft: "", conversationId: null, context: { contextArticleSlug: "exam-guide" },
  });
});
