/**
 * Forum domain events (§8 event backbone). `module.entity.action` topic strings.
 * Notifications/economy listeners subscribe in later slices — forum never calls them directly.
 */
export const ForumEventTopic = {
  /** A user requested to join a REQUEST-policy zone → owner/mod should be notified. */
  MEMBER_REQUESTED: "forum.member.requested",
  /** A feed item was posted → notification (later slice) + XP (Slice 3) listeners will subscribe. */
  THREAD_POSTED: "forum.thread.posted",
} as const;

export interface MemberRequested {
  zoneId: string;
  userId: string;
}

export interface ThreadPosted {
  zoneId: string;
  threadId: string;
  authorId: string;
}
