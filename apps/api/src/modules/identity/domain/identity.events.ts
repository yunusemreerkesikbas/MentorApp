/**
 * Identity domain events (§8 event backbone). `module.entity.action` topic strings.
 * The notifications listener subscribes; identity never calls it directly.
 */
export const IdentityEventTopic = {
  /** A user followed another user → the followee is notified. */
  USER_FOLLOWED: "identity.user.followed",
  /** A user sent a study-buddy request → the addressee is notified. */
  BUDDY_REQUESTED: "identity.buddy.requested",
  /** A buddy request was accepted → the original requester is notified. */
  BUDDY_ACCEPTED: "identity.buddy.accepted",
  /** A buddy nudged their partner → the partner is notified. */
  BUDDY_NUDGED: "identity.buddy.nudged",
  /** A buddy invited their partner to study together now → the partner is notified. */
  BUDDY_STUDY_INVITE: "identity.buddy.study-invite",
} as const;

/**
 * A user followed another user. `recipientId` = the followed user; `actorId` = the follower.
 * The actor's display fields are carried so the notification can name them without a lookup
 * (the follower is the acting request user, already loaded). `actorUsername` is null when the
 * follower never set a handle (their profile page isn't linkable → the notification omits the link).
 */
export interface UserFollowed {
  recipientId: string;
  actorId: string;
  actorDisplayName: string;
  actorUsername: string | null;
}

/**
 * Shared payload for buddy events (requested / accepted / nudged). Same actor-carrying
 * contract as {@link UserFollowed} — the listener needs no identity lookup.
 */
export interface BuddyEvent {
  recipientId: string;
  actorId: string;
  actorDisplayName: string;
  actorUsername: string | null;
}
