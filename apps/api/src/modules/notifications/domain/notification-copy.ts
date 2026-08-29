/** Stable i18n keys under `notifications.inApp.*` ([docs/copy/voice.md](../../../../../../docs/copy/voice.md)). */
export const NotificationCopyKey = {
  STREAK_BROKEN: "streakBroken",
  STREAK_MILESTONE_7: "streakMilestone7",
  STREAK_MILESTONE_14: "streakMilestone14",
  STREAK_MILESTONE_30: "streakMilestone30",
  STREAK_MILESTONE_100: "streakMilestone100",
  MOOD_LOW: "moodLow",
  FIRST_SESSION: "firstSession",
  PLAN_COMPLETED: "planCompleted",
  DAILY_REMINDER: "dailyReminder",
  SESSION_RETURN: "sessionReturn",
  SESSION_RETURN_WITH_SUBJECT: "sessionReturnWithSubject",
  NOTEBOOK_REVIEW_SINGULAR: "notebookReviewSingular",
  NOTEBOOK_REVIEW_PLURAL: "notebookReviewPlural",
  QUESTION_ANSWERED: "questionAnswered",
  THREAD_COMMENTED: "threadCommented",
  COMMENT_REPLIED: "commentReplied",
  ANSWER_ACCEPTED: "answerAccepted",
  USER_MENTIONED: "userMentioned",
  MEMBER_REQUESTED: "memberRequested",
  NEW_FOLLOWER: "newFollower",
  BUDDY_REQUESTED: "buddyRequested",
  BUDDY_ACCEPTED: "buddyAccepted",
  BUDDY_NUDGED: "buddyNudged",
  BUDDY_FIRST_SESSION: "buddyFirstSession",
  STUDY_ROOM_SESSION_STARTED: "studyRoomSessionStarted",
} as const;

export type NotificationCopyKey =
  (typeof NotificationCopyKey)[keyof typeof NotificationCopyKey];

export function streakMilestoneCopyKey(milestone: number): NotificationCopyKey {
  if (milestone >= 100) return NotificationCopyKey.STREAK_MILESTONE_100;
  if (milestone >= 30) return NotificationCopyKey.STREAK_MILESTONE_30;
  if (milestone >= 14) return NotificationCopyKey.STREAK_MILESTONE_14;
  return NotificationCopyKey.STREAK_MILESTONE_7;
}

export type NotificationCopy = {
  title: string;
  body: string;
};

export type EmailCopy = {
  subject: string;
  greeting: string;
  body: string;
  cta: string;
};
