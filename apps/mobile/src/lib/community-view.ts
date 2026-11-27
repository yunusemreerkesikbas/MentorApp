import { FORUM_IMAGE_MAX_BYTES, FORUM_IMAGE_MIMES, FORUM_MAX_ATTACHMENTS } from "@mentor/types";
import type {
  Attachment,
  ForumFeedItem,
  ForumPollView,
  ForumTagView,
  LeaderboardWindow,
  ThreadStatus,
  ThreadView,
  ZoneType,
  ZoneView,
} from "@mentor/types";

const IST_OFFSET_MS = 3 * 60 * 60 * 1000;

export type CommunityQuestionStatus =
  | { kind: "solved"; answers: number }
  | { kind: "waiting" }
  | { kind: "answers"; answers: number };

export function nextLeagueReset(window: LeaderboardWindow, now: Date): Date | null {
  if (window === "all_time") return null;
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  let dayMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  if (window === "today") {
    dayMs += 86_400_000;
  } else {
    dayMs -= ((new Date(dayMs).getUTCDay() + 6) % 7) * 86_400_000;
    dayMs += 7 * 86_400_000;
  }
  return new Date(dayMs - IST_OFFSET_MS);
}

export function formatLeagueResetParts(
  window: LeaderboardWindow,
  now: Date = new Date(),
): { days: number; hours: number; minutes: number } | null {
  const next = nextLeagueReset(window, now);
  if (!next) return null;
  const ms = Math.max(0, next.getTime() - now.getTime());
  const totalMinutes = Math.floor(ms / 60_000);
  return {
    days: Math.floor(totalMinutes / (60 * 24)),
    hours: Math.floor((totalMinutes % (60 * 24)) / 60),
    minutes: totalMinutes % 60,
  };
}

export function deriveQuestionStatus(question: {
  commentCount: number;
  acceptedPostId: string | null;
}): CommunityQuestionStatus {
  if (question.acceptedPostId) {
    return { kind: "solved", answers: question.commentCount };
  }
  return question.commentCount > 0
    ? { kind: "answers", answers: question.commentCount }
    : { kind: "waiting" };
}

export function groupZonesByMembership(zones: readonly ZoneView[]): {
  mine: ZoneView[];
  others: ZoneView[];
} {
  return {
    mine: zones.filter((zone) => zone.myStatus === "ACTIVE"),
    others: zones.filter((zone) => zone.myStatus !== "ACTIVE"),
  };
}

export interface CommunityPostModel {
  id: string;
  zone: { id: string; title: string; slug: string; type: ZoneType };
  author: {
    id: string;
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
  };
  title: string | null;
  body: string;
  attachments: Attachment[];
  poll: ForumPollView | null;
  status: ThreadStatus;
  acceptedPostId: string | null;
  isPinned: boolean;
  tags: ForumTagView[];
  reactionCounts: Record<string, number>;
  myReactions: string[];
  helpfulVoteCount: number;
  myHelpfulVote: boolean;
  canHelpfulVote: boolean;
  commentCount: number;
  myBookmarked: boolean;
  canDelete: boolean;
  createdAt: string;
}

export function feedItemToPostModel(item: ForumFeedItem): CommunityPostModel {
  return {
    id: item.id,
    zone: item.zone,
    author: item.author,
    title: item.title,
    body: item.body,
    attachments: item.attachments ?? [],
    poll: item.poll,
    status: item.status,
    acceptedPostId: item.acceptedPostId,
    isPinned: item.isPinned,
    tags: item.tags,
    reactionCounts: item.reactionCounts,
    myReactions: item.myReactions,
    helpfulVoteCount: item.helpfulVoteCount,
    myHelpfulVote: item.myHelpfulVote,
    canHelpfulVote: Boolean(item.canHelpfulVote),
    commentCount: item.commentCount,
    myBookmarked: item.myBookmarked,
    canDelete: item.capabilities.canDelete,
    createdAt: item.createdAt,
  };
}

export function threadViewToPostModel(
  thread: ThreadView,
  zone: { id: string; title: string; slug: string; type: ZoneType },
): CommunityPostModel {
  return {
    id: thread.id,
    zone,
    author: {
      id: thread.authorId,
      displayName: thread.authorName,
      username: thread.authorUsername,
      avatarUrl: thread.authorAvatarUrl,
    },
    title: thread.title,
    body: thread.body,
    attachments: thread.attachments ?? [],
    poll: thread.poll,
    status: thread.status,
    acceptedPostId: thread.acceptedPostId,
    isPinned: thread.isPinned,
    tags: thread.tags ?? [],
    reactionCounts: thread.reactionCounts,
    myReactions: thread.myReactions,
    helpfulVoteCount: thread.helpfulVoteCount ?? 0,
    myHelpfulVote: Boolean(thread.myHelpfulVote),
    canHelpfulVote: Boolean(thread.canHelpfulVote),
    commentCount: thread.commentCount,
    myBookmarked: thread.myBookmarked,
    canDelete: Boolean(thread.capabilities?.canDelete),
    createdAt: thread.createdAt,
  };
}

export type AttachError = "too_many" | "unsupported" | "too_large";

/** Why a picked photo cannot join `count` already picked ones, or null. Images only on mobile (owner, 2026-11-26). */
export function checkForumPhoto(mimeType: string, sizeBytes: number, count: number): AttachError | null {
  if (count >= FORUM_MAX_ATTACHMENTS) return "too_many";
  if (!(FORUM_IMAGE_MIMES as readonly string[]).includes(mimeType)) return "unsupported";
  if (sizeBytes > FORUM_IMAGE_MAX_BYTES) return "too_large";
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
