/**
 * Optimistic single-reaction replacement for ThreadView/CommentView. The API keeps `myReactions`
 * as an array for compatibility, but this helper enforces the 0..1 invariant on the client.
 */
export function replaceReaction<
  T extends { reactionCounts: Record<string, number>; myReactions: string[] },
>(item: T, nextEmoji: string | null): T {
  const previousEmoji = item.myReactions[0] ?? null;
  if (previousEmoji === nextEmoji) return item;
  const reactionCounts = { ...item.reactionCounts };
  if (previousEmoji) {
    reactionCounts[previousEmoji] = Math.max(0, (reactionCounts[previousEmoji] ?? 0) - 1);
    if (reactionCounts[previousEmoji] === 0) delete reactionCounts[previousEmoji];
  }
  if (nextEmoji) reactionCounts[nextEmoji] = (reactionCounts[nextEmoji] ?? 0) + 1;
  return { ...item, reactionCounts, myReactions: nextEmoji ? [nextEmoji] : [] };
}
