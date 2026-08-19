/**
 * Forum domain events (§8 event backbone). `module.entity.action` topic strings.
 * Notifications/economy listeners subscribe in later slices — forum never calls them directly.
 */
export const ForumEventTopic = {
  /** A user requested to join a REQUEST-policy zone → owner/mods are notified. */
  MEMBER_REQUESTED: "forum.member.requested",
  /** A feed item was posted → XP (Slice 3) listeners subscribe. */
  THREAD_POSTED: "forum.thread.posted",
  /** The asker accepted an answer → economy grants XP + the answerer is notified (idempotent on postId). */
  ANSWER_ACCEPTED: "forum.answer.accepted",
  /** Someone answered a QA question → the asker is notified. */
  QUESTION_ANSWERED: "forum.question.answered",
  /** Someone commented on a CHAT/ANNOUNCEMENT thread → the thread author is notified. */
  THREAD_COMMENTED: "forum.thread.commented",
  /** Someone replied to a comment → the parent comment's author is notified. */
  COMMENT_REPLIED: "forum.comment.replied",
  /** Someone @mentioned a user in a post/comment → the mentioned user is notified. */
  USER_MENTIONED: "forum.user.mentioned",
  HELPFUL_VOTE_ADDED: "forum.helpful-vote.added",
} as const;

export interface MemberRequested {
  zoneId: string;
  /** Zone slug — used to build the moderation link. */
  slug: string;
  /** The user who requested to join. */
  requesterId: string;
  /** Owner + moderator user ids to notify (resolved in forum; keeps notifications decoupled). */
  moderatorIds: string[];
}

export interface ThreadPosted {
  zoneId: string;
  threadId: string;
  authorId: string;
}

export interface AnswerAccepted {
  threadId: string;
  postId: string;
  /** The answer's author — receives the XP + notification. */
  answerAuthorId: string;
  /** The question's author (who accepted). */
  askerId: string;
}

/** A new answer landed on a QA question. `recipientId` = the asker. */
export interface QuestionAnswered {
  threadId: string;
  recipientId: string;
  actorId: string;
}

/** A new top-level comment landed on a thread. `recipientId` = the thread author. */
export interface ThreadCommented {
  threadId: string;
  recipientId: string;
  actorId: string;
}

/** A reply landed on a comment. `recipientId` = the parent comment's author. */
export interface CommentReplied {
  parentPostId: string;
  recipientId: string;
  actorId: string;
}

/** A user was @mentioned in a post/comment. `recipientId` = the mentioned user; `link` = where to go. */
export interface UserMentioned {
  recipientId: string;
  actorId: string;
  link: string;
}

export interface HelpfulVoteAdded {
  recipientId: string;
  actorId: string;
  targetId: string;
}
