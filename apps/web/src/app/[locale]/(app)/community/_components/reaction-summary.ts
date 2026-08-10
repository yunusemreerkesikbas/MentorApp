import { FORUM_REACTION_EMOJIS, type ForumReactionEmoji } from "@mentor/types";

const DEFAULT_REACTION: ForumReactionEmoji = "❤️";

export function getDefaultReactionChange(currentEmoji: string | null): {
  nextEmoji: ForumReactionEmoji | null;
  previousEmoji: string | null;
} {
  return {
    nextEmoji: currentEmoji === DEFAULT_REACTION ? null : DEFAULT_REACTION,
    previousEmoji: currentEmoji,
  };
}

export interface ReactionSummary {
  hasReactions: boolean;
  total: number;
  emojis: ForumReactionEmoji[];
}

export function getReactionSummary(reactionCounts: Record<string, number>): ReactionSummary {
  const emojis = FORUM_REACTION_EMOJIS.filter((emoji) => (reactionCounts[emoji] ?? 0) > 0);
  const total = emojis.reduce((sum, emoji) => sum + reactionCounts[emoji]!, 0);
  return { hasReactions: total > 0, total, emojis };
}
