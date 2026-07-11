/**
 * Optimistic reaction toggle for any item carrying `reactionCounts` + `myReactions` (ThreadView or
 * CommentView share the shape). Adds/removes the emoji from the viewer's set and bumps its count,
 * dropping the key when it hits zero. Pure — returns a new object.
 */
export function toggleReaction<
  T extends { reactionCounts: Record<string, number>; myReactions: string[] },
>(item: T, emoji: string, adding: boolean): T {
  const count = item.reactionCounts[emoji] ?? 0;
  const reactionCounts = { ...item.reactionCounts, [emoji]: Math.max(0, count + (adding ? 1 : -1)) };
  if (reactionCounts[emoji] === 0) delete reactionCounts[emoji];
  const myReactions = adding
    ? [...item.myReactions, emoji]
    : item.myReactions.filter((e) => e !== emoji);
  return { ...item, reactionCounts, myReactions };
}
