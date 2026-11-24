export type CoachChatRoute = {
  seed?: string;
  contextMockExamId?: string;
  contextArticleSlug?: string;
};

export function openCoachChat(
  { seed, contextMockExamId, contextArticleSlug }: CoachChatRoute = {},
  conversationId?: string | null,
) {
  const draft = typeof seed === "string" ? seed : "";
  const context = {
    ...(typeof contextMockExamId === "string" && contextMockExamId && { contextMockExamId }),
    ...(typeof contextArticleSlug === "string" && contextArticleSlug && { contextArticleSlug }),
  };
  const hasEntry = Boolean(draft || context.contextMockExamId || context.contextArticleSlug);
  return {
    draft,
    // Undefined follows history on tab entry; null explicitly starts a fresh thread.
    conversationId: conversationId === undefined && hasEntry ? null : conversationId,
    context,
  };
}
